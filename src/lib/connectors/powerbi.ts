import "server-only";
import {
  ColumnInfo,
  Connector,
  ConnectorTestResult,
  QueryRunOptions,
  QueryRunResult,
} from "./types";

export interface PowerBICredentials {
  /** Optional URL form: powerbi://TENANT_ID[/WORKSPACE_ID] */
  url?: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Optional: scope the connector to a single Power BI workspace (group). */
  workspaceId?: string;
}

function parseUrl(url?: string): { tenantId?: string; workspaceId?: string } {
  if (!url) return {};
  try {
    const u = new URL(url);
    if (u.protocol !== "powerbi:") return {};
    return {
      tenantId: u.hostname || undefined,
      workspaceId: u.pathname.replace(/^\//, "") || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Power BI service-principal connector.
 *
 * Auth: Azure AD app registration with the "Power BI Service" API permissions
 * (Tenant.Read.All or Tenant.ReadWrite.All for read; better: workspace-scoped
 * permissions via Power BI Admin portal). Service-principal OAuth client-
 * credentials flow — no interactive browser sign-in needed.
 *
 * Surface:
 *   - test() acquires a token and lists groups (workspaces) the principal
 *     can read.
 *   - listTables() returns Power BI datasets + measures as "<workspace>.<dataset>.<measure>"
 *     so the user can pick one to import as a KPI.
 *   - query() runs DAX via the executeQueries endpoint and returns the
 *     first row's first column as the value (matches the existing KPI
 *     creation contract).
 */
export class PowerBIConnector implements Connector {
  kind = "POWERBI" as const;
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private workspaceId?: string;
  private token?: { value: string; expiresAt: number };

  constructor(creds: PowerBICredentials) {
    const fromUrl = parseUrl(creds.url);
    this.tenantId = creds.tenantId || fromUrl.tenantId || "";
    this.clientId = creds.clientId;
    this.clientSecret = creds.clientSecret;
    this.workspaceId = creds.workspaceId || fromUrl.workspaceId;
    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      throw new Error(
        "Power BI: tenantId, clientId, and clientSecret are all required."
      );
    }
  }

  /** OAuth 2.0 client-credentials flow, cached until ~60s before expiry. */
  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.value;
    }
    const url = `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://analysis.windows.net/powerbi/api/.default",
    });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Token request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  private async api<T = unknown>(path: string): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`https://api.powerbi.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Power BI ${path} → ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async test(): Promise<ConnectorTestResult> {
    const started = Date.now();
    try {
      await this.getToken();
      const groups = await this.api<{ value: { id: string; name: string }[] }>(
        "/v1.0/myorg/groups?$top=5"
      );
      return {
        ok: true,
        latencyMs: Date.now() - started,
        version: `Power BI · ${groups.value.length} workspace${groups.value.length === 1 ? "" : "s"} visible`,
        ssl: true,
        message: groups.value.length
          ? `First workspace: ${groups.value[0].name}`
          : "Token obtained, but the service principal can't see any workspaces. Add it to a workspace as Member/Admin.",
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
    const result: string[] = [];
    const groups = await this.api<{ value: { id: string; name: string }[] }>(
      "/v1.0/myorg/groups" + (this.workspaceId ? `?$filter=id eq '${this.workspaceId}'` : "")
    );
    for (const g of groups.value.slice(0, 25)) {
      try {
        const datasets = await this.api<{ value: { id: string; name: string }[] }>(
          `/v1.0/myorg/groups/${g.id}/datasets`
        );
        for (const ds of datasets.value.slice(0, 50)) {
          // We could pull measures via /datasets/{id}/measures but it requires
          // the dataset to have XMLA endpoint reads enabled (Premium). For the
          // public surface we expose the dataset as the "table".
          result.push(`${g.name}.${ds.name}`);
          if (result.length >= 500) return result;
        }
      } catch {
        // Skip workspaces the principal can't enumerate.
      }
    }
    return result;
  }

  /**
   * The `sql` argument here is DAX. The user pastes a measure or `EVALUATE`
   * expression that returns a single row with one numeric column. Same
   * contract as the SQL connectors.
   *
   * Implementation:
   *   POST /v1.0/myorg/groups/{groupId}/datasets/{datasetId}/executeQueries
   *
   * To dispatch correctly we expect the dataset to be referenced as a
   * leading SQL-style comment:  `-- @dataset workspaceName.datasetName`
   * OR the connection's workspaceId being set to a single dataset.
   */
  async query(dax: string, _opts: QueryRunOptions = {}): Promise<QueryRunResult> {
    const started = Date.now();
    // Find the target dataset.
    let workspaceName = "";
    let datasetName = "";
    const match = dax.match(/--\s*@dataset\s+([^\.\s]+)\.(\S+)/i);
    if (match) {
      workspaceName = match[1];
      datasetName = match[2];
    } else if (this.workspaceId) {
      // Single workspace mode — pick its first dataset.
      const datasets = await this.api<{ value: { id: string; name: string }[] }>(
        `/v1.0/myorg/groups/${this.workspaceId}/datasets`
      );
      if (!datasets.value.length) {
        throw new Error("No datasets in the configured workspace.");
      }
      datasetName = datasets.value[0].name;
    } else {
      throw new Error(
        'Power BI DAX queries need a target. Add a comment "-- @dataset Workspace.Dataset" at the top, or configure a single-workspace connection.'
      );
    }

    // Resolve dataset id by name.
    let groupId = this.workspaceId;
    if (!groupId) {
      const groups = await this.api<{ value: { id: string; name: string }[] }>(
        `/v1.0/myorg/groups?$filter=name eq '${encodeURIComponent(workspaceName).replace(/'/g, "''")}'`
      );
      if (!groups.value.length) throw new Error(`Workspace "${workspaceName}" not found.`);
      groupId = groups.value[0].id;
    }
    const datasets = await this.api<{ value: { id: string; name: string }[] }>(
      `/v1.0/myorg/groups/${groupId}/datasets`
    );
    const ds = datasets.value.find((d) => d.name === datasetName);
    if (!ds) throw new Error(`Dataset "${datasetName}" not found in workspace.`);

    const token = await this.getToken();
    const res = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/datasets/${ds.id}/executeQueries`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queries: [{ query: dax }],
          serializerSettings: { includeNulls: true },
        }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`executeQueries → ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      results: { tables: { rows: Record<string, unknown>[] }[] }[];
    };
    const rows = data.results?.[0]?.tables?.[0]?.rows ?? [];
    const columns: ColumnInfo[] = rows.length
      ? Object.keys(rows[0]).map((name) => ({ name, type: "unknown" }))
      : [];

    return {
      columns,
      rows,
      truncated: false,
      durationMs: Date.now() - started,
    };
  }

  async dispose() {
    /* nothing to close */
  }
}
