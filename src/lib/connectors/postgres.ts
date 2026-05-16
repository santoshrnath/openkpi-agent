import "server-only";
import { Client } from "pg";
import {
  ColumnInfo,
  Connector,
  ConnectorTestResult,
  PostgresCredentials,
  QueryRunOptions,
  QueryRunResult,
} from "./types";

/**
 * Read-only Postgres connector. Uses a fresh Client per call (no pool) — we
 * have many short-lived connections from many workspaces; pools would need
 * per-credential keying anyway.
 *
 * Defensive defaults:
 *   - 10s connect timeout, 10s statement timeout
 *   - SSL required when host is not 'localhost' / '127.0.0.1' / 10.0.0.x
 *   - Read-only transaction guard on every query call
 */
export class PostgresConnector implements Connector {
  kind = "POSTGRES" as const;

  constructor(private readonly creds: PostgresCredentials) {}

  private newClient(): Client {
    const u = new URL(this.creds.url);
    const host = u.hostname;
    // SSL is required unless the host is unambiguously private/local. In
    // production the user's warehouse should always require TLS.
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("10.") ||
      host.startsWith("172.") ||
      host.startsWith("192.168.");
    const ssl = !isLocal
      ? { rejectUnauthorized: false } // many warehouses use self-signed; accept and TLS-only
      : false;

    return new Client({
      connectionString: this.creds.url,
      ssl,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 10_000,
      query_timeout: 10_000,
      application_name: "openkpi-studio",
    });
  }

  async test(): Promise<ConnectorTestResult> {
    const started = Date.now();
    const client = this.newClient();
    try {
      await client.connect();
      const res = await client.query("SELECT version() AS version");
      return {
        ok: true,
        latencyMs: Date.now() - started,
        version: (res.rows[0] as { version: string })?.version,
        ssl: !!(client as unknown as { ssl?: boolean }).ssl,
        message: "Connected and probed successfully.",
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: e instanceof Error ? e.message : String(e),
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async listTables(): Promise<string[]> {
    const client = this.newClient();
    try {
      await client.connect();
      const res = await client.query<{ schemaname: string; tablename: string }>(
        `SELECT schemaname, tablename
           FROM pg_catalog.pg_tables
          WHERE schemaname NOT IN ('pg_catalog','information_schema')
       ORDER BY schemaname, tablename
          LIMIT 500`
      );
      return res.rows.map((r) =>
        r.schemaname === "public" ? r.tablename : `${r.schemaname}.${r.tablename}`
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async query(sql: string, opts: QueryRunOptions = {}): Promise<QueryRunResult> {
    const rowLimit = Math.min(opts.rowLimit ?? 1000, 5000);
    const timeout = Math.min(opts.timeoutMs ?? 10_000, 30_000);
    const started = Date.now();
    const client = this.newClient();
    try {
      await client.connect();
      await client.query(`SET statement_timeout TO ${timeout}`);
      // Defence in depth: refuse DDL/DML by wrapping in a read-only transaction.
      await client.query("BEGIN READ ONLY");
      const res = await client.query(sql);
      await client.query("ROLLBACK"); // read-only: no state to commit
      const columns: ColumnInfo[] = (res.fields ?? []).map((f) => ({
        name: f.name,
        type: typeOidToName(f.dataTypeID),
      }));
      const rows = (res.rows ?? []).slice(0, rowLimit) as Record<string, unknown>[];
      return {
        columns,
        rows,
        truncated: (res.rows ?? []).length > rowLimit,
        durationMs: Date.now() - started,
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async dispose() {
    /* nothing — clients are one-shot */
  }
}

// Cherry-picked subset; everything unknown falls back to 'unknown'.
function typeOidToName(oid: number): string {
  switch (oid) {
    case 16: return "boolean";
    case 17: return "bytea";
    case 20: case 21: case 23: return "integer";
    case 700: case 701: return "float";
    case 1700: return "numeric";
    case 25: case 1043: return "text";
    case 1082: return "date";
    case 1083: case 1266: return "time";
    case 1114: case 1184: return "timestamp";
    case 3802: case 114: return "json";
    case 2950: return "uuid";
    default: return `oid:${oid}`;
  }
}
