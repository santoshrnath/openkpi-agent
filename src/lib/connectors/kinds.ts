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
    available: false,
    urlPlaceholder: "needs OAuth — service account JSON",
    urlHelp: "Coming soon: drop a service-account JSON key with BigQuery Data Viewer.",
  },
  {
    id: "POWERBI",
    label: "Power BI (metadata)",
    available: false,
    urlPlaceholder: "needs Azure AD app registration",
    urlHelp: "Coming soon: imports measure metadata from a Power BI workspace.",
  },
];
