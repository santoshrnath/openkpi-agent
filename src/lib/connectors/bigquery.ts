import "server-only";
import { BigQuery } from "@google-cloud/bigquery";
import {
  ColumnInfo,
  Connector,
  ConnectorTestResult,
  QueryRunOptions,
  QueryRunResult,
} from "./types";

export interface BigQueryCredentials {
  /**
   * Optional URL: bigquery://PROJECT_ID[/DATASET]
   * If omitted, projectId is inferred from the service-account JSON.
   */
  url?: string;
  /**
   * The full service-account JSON, parsed as an object. The structure follows
   * Google's standard:
   *   { type, project_id, private_key_id, private_key, client_email, ... }
   */
  serviceAccount: Record<string, unknown>;
  /** Default dataset when running queries (optional, can be overridden in SQL). */
  defaultDataset?: string;
}

function parseUrl(url?: string): { projectId?: string; dataset?: string } {
  if (!url) return {};
  try {
    const u = new URL(url);
    if (u.protocol !== "bigquery:") return {};
    const project = u.hostname;
    const dataset = u.pathname.replace(/^\//, "").split("/")[0] || undefined;
    return { projectId: project || undefined, dataset };
  } catch {
    return {};
  }
}

/**
 * Read-only BigQuery connector.
 *
 * Auth is via a Google service-account JSON key (created in IAM &amp; Admin →
 * Service Accounts → Keys). The key must have the BigQuery Data Viewer +
 * BigQuery Job User roles on the project. We never write or modify; the
 * SDK still issues "jobs" but with read-only SQL.
 */
export class BigQueryConnector implements Connector {
  kind = "BIGQUERY" as const;
  private client: BigQuery;
  private projectId?: string;
  private dataset?: string;

  constructor(creds: BigQueryCredentials) {
    const fromUrl = parseUrl(creds.url);
    const sa = creds.serviceAccount;
    this.projectId =
      fromUrl.projectId ?? (sa.project_id as string | undefined) ?? undefined;
    this.dataset = creds.defaultDataset ?? fromUrl.dataset;

    if (!this.projectId) {
      throw new Error(
        "BigQuery: project_id missing — provide it in the URL (bigquery://PROJECT) or in the service-account JSON."
      );
    }
    if (!sa.client_email || !sa.private_key) {
      throw new Error(
        "BigQuery: service-account JSON is missing client_email or private_key."
      );
    }

    this.client = new BigQuery({
      projectId: this.projectId,
      credentials: {
        client_email: sa.client_email as string,
        private_key: sa.private_key as string,
      },
    });
  }

  async test(): Promise<ConnectorTestResult> {
    const started = Date.now();
    try {
      const [rows] = await this.client.query({
        query: "SELECT CURRENT_TIMESTAMP() AS ts",
        maximumBytesBilled: "10485760", // 10 MB cap on the probe
      });
      return {
        ok: true,
        latencyMs: Date.now() - started,
        version: `BigQuery — project ${this.projectId}`,
        ssl: true,
        message: `Probe ran. CURRENT_TIMESTAMP=${(rows[0] as { ts?: unknown })?.ts ?? "?"}`,
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async listTables(): Promise<string[]> {
    if (this.dataset) {
      const [tables] = await this.client.dataset(this.dataset).getTables();
      return tables.map((t) => `${this.dataset}.${t.id}`).slice(0, 500);
    }
    // No specific dataset — list datasets, take the first 50 + their tables.
    const [datasets] = await this.client.getDatasets({ maxResults: 50 });
    const result: string[] = [];
    for (const ds of datasets) {
      try {
        const [tables] = await ds.getTables({ maxResults: 20 });
        for (const t of tables) {
          result.push(`${ds.id}.${t.id}`);
          if (result.length >= 500) return result;
        }
      } catch {
        // ignore datasets we can't read
      }
    }
    return result;
  }

  async query(sql: string, opts: QueryRunOptions = {}): Promise<QueryRunResult> {
    const rowLimit = Math.min(opts.rowLimit ?? 1000, 5000);
    const started = Date.now();
    const [job] = await this.client.createQueryJob({
      query: sql,
      maximumBytesBilled: "1073741824", // 1 GB cap (defence-in-depth)
      defaultDataset: this.dataset
        ? { projectId: this.projectId!, datasetId: this.dataset }
        : undefined,
      jobTimeoutMs: Math.min(opts.timeoutMs ?? 20_000, 60_000),
    });
    const [rows] = await job.getQueryResults({ maxResults: rowLimit });
    const [metadata] = await job.getMetadata();
    const schema = metadata.configuration?.query?.destinationTable
      ? (await job.getQueryResults({ maxResults: 0 }))[2]?.schema
      : (metadata.statistics?.query?.schema ??
         metadata.configuration?.query?.schemaUpdateOptions);

    let columns: ColumnInfo[] = [];
    // Infer columns from the first row if schema metadata is missing.
    type SchemaLike = { fields?: { name: string; type: string }[] };
    const schemaLike = schema as SchemaLike | undefined;
    if (schemaLike?.fields) {
      columns = schemaLike.fields.map((f) => ({ name: f.name, type: f.type }));
    } else if (rows.length > 0) {
      columns = Object.keys(rows[0] as object).map((k) => ({ name: k, type: "unknown" }));
    }

    return {
      columns,
      rows: rows as Record<string, unknown>[],
      truncated: false, // BigQuery's maxResults is what we asked for; full size is in statistics
      durationMs: Date.now() - started,
    };
  }

  async dispose() {
    /* SDK client has no explicit close */
  }
}
