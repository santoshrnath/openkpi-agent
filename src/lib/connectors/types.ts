// Pure type/interface declarations — client-safe (no `server-only` import).
// Runtime connector code lives in ./postgres etc.

export type ConnectorKind =
  | "POSTGRES"
  | "MSSQL"
  | "SNOWFLAKE"
  | "BIGQUERY"
  | "SALESFORCE"
  | "COUPA"
  | "WORKDAY"
  | "POWERBI"
  | "SAP"
  | "CSV"
  | "EXCEL";

/**
 * Credentials are always parsed from the decrypted credentialsCipher blob.
 * Each kind has its own credential shape.
 */
export interface PostgresCredentials {
  url: string; // e.g. postgresql://user:pass@host:5432/db?sslmode=require
}

export interface ConnectorTestResult {
  ok: boolean;
  /** Time taken to connect + run a probe query, in ms. */
  latencyMs?: number;
  /** Server-reported version string, when available. */
  version?: string;
  /** Whether the connection used TLS. */
  ssl?: boolean;
  message: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface QueryRunOptions {
  /** Hard cap on rows returned. Default 1000 for previews. */
  rowLimit?: number;
  /** Query timeout in ms. Default 10s. */
  timeoutMs?: number;
}

export interface QueryRunResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  /** Whether the row count was capped by rowLimit. */
  truncated: boolean;
  /** Time taken to run, in ms. */
  durationMs: number;
}

/**
 * The Connector interface. Each kind (Postgres, Snowflake, BigQuery, etc.)
 * implements this. The UI and the refresh scheduler talk only to this
 * abstraction, so adding a new source is a single-file change plus a
 * registry entry.
 */
export interface Connector {
  kind: ConnectorKind;
  test(): Promise<ConnectorTestResult>;
  listTables(): Promise<string[]>;
  query(sql: string, opts?: QueryRunOptions): Promise<QueryRunResult>;
  /** Close any persistent resources (pools, drivers). */
  dispose(): Promise<void>;
}
