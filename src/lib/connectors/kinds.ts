// Client-safe — describes which connector kinds the UI can offer.
import type { ConnectorKind } from "./types";

export interface KindMeta {
  id: ConnectorKind;
  label: string;
  available: boolean;
  /** Placeholder in the connection-URL textbox. */
  urlPlaceholder: string;
  /** Short helper sentence shown under the URL field. */
  urlHelp: string;
  /** Regex the URL must match for create. Empty = no client-side validation. */
  urlPattern?: string;
  /**
   * Additional JSON-shaped credentials beyond the URL. When present the UI
   * shows a labelled textarea below the URL field. The server parses the
   * value as JSON and stores the merged object as the encrypted credentials
   * blob.
   */
  extraField?: {
    label: string;
    placeholder: string;
    help: string;
  };
}

export const SUPPORTED_KINDS: KindMeta[] = [
  {
    id: "POSTGRES",
    label: "Postgres / Redshift / Aurora",
    available: true,
    urlPlaceholder: "postgresql://user:password@host:5432/dbname?sslmode=require",
    urlHelp: "Standard libpq connection string. SSL auto-enabled for non-private hosts.",
    urlPattern: "^postgres(ql)?://",
  },
  {
    id: "SNOWFLAKE",
    label: "Snowflake",
    available: true,
    urlPlaceholder: "snowflake://USER:PASSWORD@ACCOUNT/DB?warehouse=WH&role=R&schema=PUBLIC",
    urlHelp: "Replace ACCOUNT with your Snowflake account locator (e.g. xy12345.eu-central-1). TLS always.",
    urlPattern: "^snowflake://",
  },
  {
    id: "MSSQL",
    label: "SQL Server / Azure SQL",
    available: true,
    urlPlaceholder: "mssql://user:password@host:1433/dbname?encrypt=true",
    urlHelp: "Encrypts in transit by default. For Azure SQL the host is your-server.database.windows.net.",
    urlPattern: "^(mssql|sqlserver)://",
  },
  {
    id: "BIGQUERY",
    label: "BigQuery",
    available: true,
    urlPlaceholder: "bigquery://PROJECT_ID[/DATASET]",
    urlHelp: "Project ID required (e.g. acme-analytics-prod). Optional default dataset.",
    urlPattern: "^bigquery://",
    extraField: {
      label: "Service-account JSON key",
      placeholder:
        '{\n  "type": "service_account",\n  "project_id": "acme-analytics-prod",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "openkpi@acme.iam.gserviceaccount.com"\n}',
      help: "Paste the full JSON key from Google Cloud IAM. Needs BigQuery Data Viewer + Job User roles.",
    },
  },
  {
    id: "POWERBI",
    label: "Power BI (metadata)",
    available: true,
    urlPlaceholder: "powerbi://TENANT_ID[/WORKSPACE_ID]",
    urlHelp: "Tenant ID is your Azure AD tenant GUID. Optional workspace ID to scope.",
    urlPattern: "^powerbi://",
    extraField: {
      label: "Service principal credentials",
      placeholder:
        '{\n  "tenantId": "11111111-2222-3333-4444-555555555555",\n  "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",\n  "clientSecret": "your-app-secret"\n}',
      help: "Azure AD app with Power BI Tenant.Read.All permission, added to the workspace as Member/Admin.",
    },
  },
  {
    id: "CSV",
    label: "Upload CSV",
    available: true,
    // The /connections/new UI special-cases CSV to show a file picker
    // instead of the URL+extra fields. These two placeholders are
    // unused but kept for type-shape symmetry.
    urlPlaceholder: "",
    urlHelp: "Upload a CSV (max 8MB). We infer column types from the first 200 rows and let you query it in plain English just like a database.",
  },
  {
    id: "EXCEL",
    label: "Upload Excel",
    available: true,
    urlPlaceholder: "",
    urlHelp: "Upload an .xlsx or .xls file (max 8MB). We parse the first sheet, infer column types, and query the same way as a CSV.",
  },
];
