import "server-only";
import alasql from "alasql";
import {
  ColumnInfo,
  Connector,
  ConnectorKind,
  ConnectorTestResult,
  QueryRunOptions,
  QueryRunResult,
} from "./types";

/**
 * Shape persisted in SourceConnection.config for CSV uploads.
 *
 * The full row payload lives here too — for 4MB CSV caps this is fine
 * (Postgres jsonb is happy with multi-megabyte values). We don't store
 * the raw CSV file because we always need typed values to run aggregations.
 */
export interface CsvConfig {
  /** Logical table name surfaced by listTables() and used in user queries. */
  tableName: string;
  /** Inferred per-column type from the first 200 rows. */
  columns: { name: string; type: "INT" | "FLOAT" | "DATE" | "BOOL" | "TEXT" }[];
  rows: Record<string, unknown>[];
  /** Original filename — shown in the UI for context. */
  filename: string;
  rowCount: number;
}

const CSV_TYPE_TO_SQL: Record<CsvConfig["columns"][number]["type"], string> = {
  INT: "INTEGER",
  FLOAT: "DOUBLE",
  DATE: "DATE",
  BOOL: "BOOLEAN",
  TEXT: "VARCHAR",
};

/**
 * CSV connector — backs the "Upload CSV" data source.
 *
 * Reads the parsed rows + inferred schema out of `SourceConnection.config`
 * and serves SELECT queries via alasql. Same Connector interface as the
 * Postgres / Snowflake / MSSQL / BigQuery / PowerBI connectors, so the
 * AI chat and the SQL editor light up automatically.
 */
export class CsvConnector implements Connector {
  readonly kind: ConnectorKind = "CSV";
  private readonly cfg: CsvConfig;

  constructor(cfg: CsvConfig) {
    this.cfg = cfg;
  }

  async test(): Promise<ConnectorTestResult> {
    return {
      ok: true,
      latencyMs: 0,
      version: `csv (${this.cfg.rowCount} rows, ${this.cfg.columns.length} cols)`,
      ssl: false,
      message: `Loaded ${this.cfg.filename} — ${this.cfg.rowCount} rows`,
    };
  }

  async listTables(): Promise<string[]> {
    return [this.cfg.tableName];
  }

  async query(sql: string, opts: QueryRunOptions = {}): Promise<QueryRunResult> {
    const rowLimit = Math.min(opts.rowLimit ?? 1000, 5000);
    const started = Date.now();

    // Each query gets its own alasql database to avoid table-name collisions
    // across concurrent requests. Cheap — alasql is in-memory and we re-load
    // the rows for each call.
    const db = new alasql.Database();
    const colsDdl = this.cfg.columns
      .map((c) => `\`${c.name}\` ${CSV_TYPE_TO_SQL[c.type]}`)
      .join(", ");
    db.exec(`CREATE TABLE \`${this.cfg.tableName}\` (${colsDdl})`);
    if (this.cfg.rows.length > 0) {
      // alasql's types are loose here — tables is a Record<string, Table>.
      // Direct .data assignment is much faster than running INSERTs row-by-row.
      const tables = (db as unknown as { tables: Record<string, { data: unknown[] }> }).tables;
      tables[this.cfg.tableName].data = this.cfg.rows.slice();
    }

    // alasql defaults to extending the global namespace; we explicitly route
    // the query through this db only.
    const result = db.exec(sql) as Record<string, unknown>[] | number;

    // Aggregations / SELECTs come back as an array; DDL/DML come back as a
    // number (rows affected). We're read-only so we expect arrays.
    const rows = Array.isArray(result) ? result : [];
    const capped = rows.slice(0, rowLimit);
    const columns: ColumnInfo[] =
      capped[0]
        ? Object.keys(capped[0]).map((name) => ({
            name,
            type: inferReturnedType(capped, name),
          }))
        : [];

    return {
      columns,
      rows: capped,
      truncated: rows.length > rowLimit,
      durationMs: Date.now() - started,
    };
  }

  async dispose(): Promise<void> {
    // Nothing to dispose — alasql DBs are GC'd per query.
  }
}

function inferReturnedType(rows: Record<string, unknown>[], col: string): string {
  for (const r of rows) {
    const v = r[col];
    if (v == null) continue;
    if (typeof v === "number") return Number.isInteger(v) ? "INTEGER" : "DOUBLE";
    if (typeof v === "boolean") return "BOOLEAN";
    if (v instanceof Date) return "DATE";
    return "VARCHAR";
  }
  return "VARCHAR";
}

/**
 * Detect per-column types by scanning the first N rows.
 * Used at upload time so the AI chat can ground SQL in real types.
 */
export function inferCsvColumns(
  headers: string[],
  rows: Record<string, unknown>[]
): CsvConfig["columns"] {
  const SAMPLE = Math.min(rows.length, 200);
  const result: CsvConfig["columns"] = [];
  for (const h of headers) {
    let allInt = true;
    let allFloat = true;
    let allBool = true;
    let allDate = true;
    let nonEmpty = 0;
    for (let i = 0; i < SAMPLE; i++) {
      const v = rows[i]?.[h];
      if (v == null || v === "") continue;
      nonEmpty++;
      const s = String(v).trim();
      if (s !== "true" && s !== "false" && s !== "TRUE" && s !== "FALSE") allBool = false;
      // INT: pure integer
      if (!/^-?\d+$/.test(s)) allInt = false;
      // FLOAT: numeric with optional decimal / scientific
      if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) allFloat = false;
      // DATE: ISO-ish or common short forms
      if (
        !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/.test(s) &&
        !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)
      )
        allDate = false;
    }
    let type: CsvConfig["columns"][number]["type"] = "TEXT";
    if (nonEmpty > 0) {
      if (allBool) type = "BOOL";
      else if (allInt) type = "INT";
      else if (allFloat) type = "FLOAT";
      else if (allDate) type = "DATE";
    }
    result.push({ name: h, type });
  }
  return result;
}
