import "server-only";
import { Connector, ConnectorKind } from "./types";
import type { CsvConfig } from "./csv";

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string }[];
}

export interface SchemaSnapshot {
  dialect: string;
  tables: SchemaTable[];
  truncated: boolean;
}

const DIALECT: Record<ConnectorKind, string> = {
  POSTGRES: "PostgreSQL (use LIMIT, no TOP). Quote identifiers with double quotes.",
  MSSQL: "Microsoft SQL Server / T-SQL (use TOP N, never LIMIT). Quote identifiers with square brackets.",
  SNOWFLAKE: "Snowflake SQL (use LIMIT). Identifiers default to UPPERCASE.",
  BIGQUERY: "Google BigQuery Standard SQL (use LIMIT). Backtick-quote identifiers.",
  POWERBI: "Power BI / DAX. Use EVALUATE with TOPN and ROW.",
  SALESFORCE: "Salesforce SOQL.",
  COUPA: "Coupa API.",
  WORKDAY: "Workday API.",
  SAP: "SAP HANA SQL.",
  CSV: "In-memory CSV via alasql. Use LIMIT. Backtick-quote column names that contain spaces or punctuation. Dates are stored as strings — wrap in DATE(col) or compare as strings if needed.",
  EXCEL: "In-memory Excel via alasql (first sheet only). Use LIMIT. Backtick-quote column names that contain spaces or punctuation. Dates are strings — wrap in DATE(col) or compare as strings.",
};

const MAX_TABLES = 50;
const MAX_COLS = 25;

/**
 * Runs a per-dialect INFORMATION_SCHEMA query to fetch tables + columns.
 * Used to ground the AI chat system prompt. Best-effort — falls back to
 * just the listTables() output if the schema query fails.
 */
export async function getSchemaSnapshot(
  c: Connector,
  kind: ConnectorKind,
  config?: unknown
): Promise<SchemaSnapshot> {
  const dialect = DIALECT[kind] ?? "SQL";

  // CSV / Excel connections embed their full schema in `config` — no DB hop.
  if ((kind === "CSV" || kind === "EXCEL") && config && typeof config === "object") {
    const cfg = config as CsvConfig;
    if (Array.isArray(cfg.columns) && cfg.tableName) {
      return {
        dialect,
        tables: [
          {
            name: cfg.tableName,
            columns: cfg.columns.map((col) => ({ name: col.name, type: col.type })),
          },
        ],
        truncated: false,
      };
    }
  }

  // For Postgres / MSSQL / Snowflake / BigQuery we use INFORMATION_SCHEMA;
  // for PowerBI and others we just return the table list.
  let sql = "";
  switch (kind) {
    case "POSTGRES":
      sql = `
        SELECT table_schema || '.' || table_name AS t, column_name AS c, data_type AS dt
          FROM information_schema.columns
         WHERE table_schema NOT IN ('pg_catalog','information_schema')
         ORDER BY table_schema, table_name, ordinal_position
         LIMIT 2000`;
      break;
    case "MSSQL":
      sql = `
        SELECT TOP 2000
               TABLE_SCHEMA + '.' + TABLE_NAME AS t,
               COLUMN_NAME AS c,
               DATA_TYPE AS dt
          FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA NOT IN ('sys','INFORMATION_SCHEMA')
         ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`;
      break;
    case "SNOWFLAKE":
      sql = `
        SELECT TABLE_SCHEMA || '.' || TABLE_NAME AS t,
               COLUMN_NAME AS c,
               DATA_TYPE AS dt
          FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA')
         ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
         LIMIT 2000`;
      break;
    case "BIGQUERY":
      // BigQuery requires a specific dataset prefix; fall back to listTables().
      sql = "";
      break;
    default:
      sql = "";
  }

  let tables: SchemaTable[] = [];
  let truncated = false;

  if (sql) {
    try {
      const r = await c.query(sql, { rowLimit: 2000, timeoutMs: 15_000 });
      const byTable = new Map<string, { name: string; type: string }[]>();
      for (const row of r.rows) {
        const t = String(row.t ?? row.T ?? "");
        const col = String(row.c ?? row.C ?? "");
        const dt = String(row.dt ?? row.DT ?? "");
        if (!t || !col) continue;
        if (!byTable.has(t)) byTable.set(t, []);
        const arr = byTable.get(t)!;
        if (arr.length < MAX_COLS) arr.push({ name: col, type: dt });
      }
      tables = Array.from(byTable.entries())
        .slice(0, MAX_TABLES)
        .map(([name, columns]) => ({ name, columns }));
      truncated = byTable.size > MAX_TABLES;
    } catch {
      // fall through to listTables() fallback below
    }
  }

  if (tables.length === 0) {
    const names = await c.listTables();
    tables = names.slice(0, MAX_TABLES).map((name) => ({ name, columns: [] }));
    truncated = names.length > MAX_TABLES;
  }

  return { dialect, tables, truncated };
}

/**
 * Renders the snapshot as compact text for the LLM prompt.
 * Format keeps token count low while preserving table.col[type] info.
 */
export function renderSchemaForPrompt(snap: SchemaSnapshot): string {
  const lines: string[] = [];
  lines.push(`Dialect: ${snap.dialect}`);
  lines.push(`Tables (${snap.tables.length}${snap.truncated ? "+, truncated" : ""}):`);
  for (const t of snap.tables) {
    if (t.columns.length === 0) {
      lines.push(`- ${t.name}`);
    } else {
      const cols = t.columns.map((c) => `${c.name}:${c.type}`).join(", ");
      lines.push(`- ${t.name}(${cols})`);
    }
  }
  return lines.join("\n");
}
