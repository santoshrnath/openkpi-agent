import "server-only";
import snowflake from "snowflake-sdk";
import {
  ColumnInfo,
  Connector,
  ConnectorTestResult,
  QueryRunOptions,
  QueryRunResult,
} from "./types";

export interface SnowflakeCredentials {
  /** Accepts one of:
   *  - snowflake://USER:PASSWORD@ACCOUNT_LOCATOR/DATABASE?warehouse=WH&role=R&schema=S
   *  - JSON: {"account":"...","username":"...","password":"...","database":"...","warehouse":"...","role":"...","schema":"..."}
   *  The PostgresConnector accepted a raw URL; we accept either to keep the
   *  UI's "Connection URL" field consistent.
   */
  url?: string;
  account?: string;
  username?: string;
  password?: string;
  database?: string;
  warehouse?: string;
  role?: string;
  schema?: string;
}

function parseCreds(raw: SnowflakeCredentials): Required<Omit<SnowflakeCredentials, "url">> {
  // Object form takes precedence
  if (raw.account && raw.username && raw.password) {
    return {
      account: raw.account,
      username: raw.username,
      password: raw.password,
      database: raw.database ?? "",
      warehouse: raw.warehouse ?? "",
      role: raw.role ?? "",
      schema: raw.schema ?? "PUBLIC",
    };
  }
  if (!raw.url) throw new Error("Missing Snowflake credentials");

  const u = new URL(raw.url);
  if (u.protocol !== "snowflake:") {
    throw new Error("Snowflake URL must start with snowflake://");
  }
  const params = u.searchParams;
  return {
    account: u.hostname,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    warehouse: params.get("warehouse") ?? "",
    role: params.get("role") ?? "",
    schema: params.get("schema") ?? "PUBLIC",
  };
}

/**
 * Read-only Snowflake connector. Uses snowflake-sdk with a fresh connection per
 * call. Snowflake's protocol is HTTPS underneath so SSL is always on.
 */
export class SnowflakeConnector implements Connector {
  kind = "SNOWFLAKE" as const;
  private cfg: Required<Omit<SnowflakeCredentials, "url">>;

  constructor(creds: SnowflakeCredentials) {
    this.cfg = parseCreds(creds);
  }

  private connect(): Promise<snowflake.Connection> {
    const conn = snowflake.createConnection({
      account: this.cfg.account,
      username: this.cfg.username,
      password: this.cfg.password,
      database: this.cfg.database || undefined,
      warehouse: this.cfg.warehouse || undefined,
      role: this.cfg.role || undefined,
      schema: this.cfg.schema || undefined,
      timeout: 10_000,
      application: "openkpi-studio",
    });
    return new Promise((resolve, reject) => {
      conn.connect((err, c) => (err ? reject(err) : resolve(c)));
    });
  }

  private exec<T = Record<string, unknown>>(conn: snowflake.Connection, sql: string): Promise<{ rows: T[]; columns: ColumnInfo[] }> {
    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        complete: (err, stmt, rows) => {
          if (err) return reject(err);
          const cols = stmt.getColumns().map((c) => ({
            name: c.getName(),
            type: c.getType(),
          }));
          resolve({ rows: (rows ?? []) as T[], columns: cols });
        },
      });
    });
  }

  async test(): Promise<ConnectorTestResult> {
    const started = Date.now();
    let conn: snowflake.Connection | null = null;
    try {
      conn = await this.connect();
      const r = await this.exec<{ V: string }>(conn, "SELECT CURRENT_VERSION() AS V");
      return {
        ok: true,
        latencyMs: Date.now() - started,
        version: r.rows[0]?.V,
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
      conn?.destroy(() => undefined);
    }
  }

  async listTables(): Promise<string[]> {
    let conn: snowflake.Connection | null = null;
    try {
      conn = await this.connect();
      // INFORMATION_SCHEMA.TABLES is the portable choice across accounts.
      const sql = `SELECT TABLE_SCHEMA || '.' || TABLE_NAME AS T
                     FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA')
                 ORDER BY 1
                    LIMIT 500`;
      const r = await this.exec<{ T: string }>(conn, sql);
      return r.rows.map((r) => r.T);
    } finally {
      conn?.destroy(() => undefined);
    }
  }

  async query(sql: string, opts: QueryRunOptions = {}): Promise<QueryRunResult> {
    const rowLimit = Math.min(opts.rowLimit ?? 1000, 5000);
    const started = Date.now();
    let conn: snowflake.Connection | null = null;
    try {
      conn = await this.connect();
      // Snowflake doesn't support BEGIN READ ONLY the same way Postgres does;
      // rely on the API-layer regex guard + a least-privilege role.
      const r = await this.exec(conn, sql);
      return {
        columns: r.columns,
        rows: r.rows.slice(0, rowLimit),
        truncated: r.rows.length > rowLimit,
        durationMs: Date.now() - started,
      };
    } finally {
      conn?.destroy(() => undefined);
    }
  }

  async dispose() {
    /* connection lifecycle is per-call */
  }
}
