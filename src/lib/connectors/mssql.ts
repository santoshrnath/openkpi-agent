import "server-only";
import mssql from "mssql";
import {
  ColumnInfo,
  Connector,
  ConnectorTestResult,
  QueryRunOptions,
  QueryRunResult,
} from "./types";

export interface MssqlCredentials {
  /** Accepts ADO-style or URL-style:
   *  - sqlserver://USER:PASSWORD@host:1433/DB?encrypt=true
   *  - mssql://USER:PASSWORD@host:1433;database=DB;encrypt=true
   *  - JSON: { server, user, password, database, port?, encrypt?, trustServerCertificate? }
   *  The mssql package handles the second form natively.
   */
  url?: string;
  server?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

function toConfig(raw: MssqlCredentials): mssql.config {
  if (raw.server && raw.user && raw.password) {
    return {
      server: raw.server,
      port: raw.port ?? 1433,
      user: raw.user,
      password: raw.password,
      database: raw.database,
      options: {
        encrypt: raw.encrypt ?? true,
        trustServerCertificate: raw.trustServerCertificate ?? false,
      },
      connectionTimeout: 10_000,
      requestTimeout: 10_000,
    } as mssql.config;
  }
  if (!raw.url) throw new Error("Missing MSSQL credentials");

  // The mssql package's connection-string parser accepts:
  //   mssql://user:password@host:1433/db?encrypt=true
  //   sqlserver://user:password@host:1433/db?encrypt=true
  // We normalise to mssql:// so the parser is consistent.
  let url = raw.url;
  if (url.startsWith("sqlserver://")) url = "mssql://" + url.slice("sqlserver://".length);
  // The mssql library expects { connectionString } AS the entire arg.
  return { connectionString: url } as unknown as mssql.config;
}

/**
 * Read-only SQL Server / Azure SQL connector. Uses the official `mssql`
 * package (which uses `tedious` under the hood). One connection pool per
 * connector instance — disposed after every call to keep things short-lived.
 */
export class MssqlConnector implements Connector {
  kind = "MSSQL" as const;
  private cfg: mssql.config;

  constructor(creds: MssqlCredentials) {
    this.cfg = toConfig(creds);
  }

  private async pool(): Promise<mssql.ConnectionPool> {
    return new mssql.ConnectionPool(this.cfg).connect();
  }

  async test(): Promise<ConnectorTestResult> {
    const started = Date.now();
    let pool: mssql.ConnectionPool | null = null;
    try {
      pool = await this.pool();
      const r = await pool.request().query("SELECT @@VERSION AS version");
      const version = (r.recordset?.[0] as { version?: string })?.version;
      return {
        ok: true,
        latencyMs: Date.now() - started,
        version: version?.replace(/\s+/g, " ").slice(0, 200),
        ssl: true,
        message: "Connected and probed successfully.",
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: e instanceof Error ? e.message : String(e),
      };
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }

  async listTables(): Promise<string[]> {
    let pool: mssql.ConnectionPool | null = null;
    try {
      pool = await this.pool();
      const r = await pool.request().query<{ s: string; t: string }>(`
        SELECT TOP 500 TABLE_SCHEMA AS s, TABLE_NAME AS t
          FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY s, t
      `);
      return r.recordset.map((r) => `${r.s}.${r.t}`);
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }

  async query(sql: string, opts: QueryRunOptions = {}): Promise<QueryRunResult> {
    const rowLimit = Math.min(opts.rowLimit ?? 1000, 5000);
    const started = Date.now();
    let pool: mssql.ConnectionPool | null = null;
    try {
      pool = await this.pool();
      const req = pool.request();
      // SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED is the closest
      // equivalent to a read-only intent on MSSQL; combined with the
      // API-layer SQL regex guard.
      await req.query("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED");
      const r = await req.query(sql);
      const columns: ColumnInfo[] = Object.keys(r.recordset?.columns ?? {}).map((name) => {
        const c = r.recordset.columns[name];
        return { name, type: (c?.type as { name?: string })?.name ?? "unknown" };
      });
      const rows = (r.recordset ?? []) as unknown as Record<string, unknown>[];
      return {
        columns,
        rows: rows.slice(0, rowLimit),
        truncated: rows.length > rowLimit,
        durationMs: Date.now() - started,
      };
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }

  async dispose() {
    /* per-call pool lifecycle */
  }
}
