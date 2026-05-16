// Client-safe — describes which connector kinds the UI can offer.
import type { ConnectorKind } from "./types";

export const SUPPORTED_KINDS: { id: ConnectorKind; label: string; available: boolean }[] = [
  { id: "POSTGRES", label: "Postgres / Redshift / Aurora", available: true },
  { id: "SNOWFLAKE", label: "Snowflake", available: false },
  { id: "BIGQUERY", label: "BigQuery", available: false },
  { id: "MSSQL", label: "SQL Server / Azure SQL", available: false },
  { id: "POWERBI", label: "Power BI (metadata)", available: false },
];
