import "server-only";
import { Prisma, SourceKind } from "@prisma/client";
import { decryptJson } from "@/lib/crypto";
import { Connector, ConnectorKind } from "./types";
import { PostgresConnector } from "./postgres";
import { SnowflakeConnector, SnowflakeCredentials } from "./snowflake";
import { MssqlConnector, MssqlCredentials } from "./mssql";
import { BigQueryConnector, BigQueryCredentials } from "./bigquery";
import { PowerBIConnector, PowerBICredentials } from "./powerbi";
import { CsvConnector, CsvConfig } from "./csv";

export { SUPPORTED_KINDS } from "./kinds";

/**
 * Take a row from `SourceConnection` and instantiate the right Connector.
 * Decrypts credentials at the boundary.
 *
 * Unsupported kinds throw — UI gates against them at create time.
 */
export function makeConnector(row: {
  kind: SourceKind;
  credentialsCipher: string | null;
  config?: Prisma.JsonValue | null;
}): Connector {
  const kind = row.kind as ConnectorKind;

  // CSV / Excel are special — no encrypted creds; the parsed rows + inferred
  // schema live in plaintext `config` (it's not secret, it's data the
  // workspace owns). Same CsvConnector serves both because once parsed the
  // payload shape is identical.
  if (kind === "CSV" || kind === "EXCEL") {
    if (!row.config) throw new Error(`${kind} connection has no data uploaded.`);
    return new CsvConnector(row.config as unknown as CsvConfig);
  }

  if (!row.credentialsCipher) {
    throw new Error("Connection has no credentials configured.");
  }
  switch (kind) {
    case "POSTGRES": {
      const creds = decryptJson<{ url: string }>(row.credentialsCipher);
      return new PostgresConnector(creds);
    }
    case "SNOWFLAKE": {
      const creds = decryptJson<SnowflakeCredentials>(row.credentialsCipher);
      return new SnowflakeConnector(creds);
    }
    case "MSSQL": {
      const creds = decryptJson<MssqlCredentials>(row.credentialsCipher);
      return new MssqlConnector(creds);
    }
    case "BIGQUERY": {
      const creds = decryptJson<BigQueryCredentials>(row.credentialsCipher);
      return new BigQueryConnector(creds);
    }
    case "POWERBI": {
      const creds = decryptJson<PowerBICredentials>(row.credentialsCipher);
      return new PowerBIConnector(creds);
    }
    case "SALESFORCE":
    case "COUPA":
    case "WORKDAY":
    case "SAP":
      throw new Error(
        `${kind} connector is on the roadmap. Postgres, Snowflake, SQL Server, BigQuery, Power BI, CSV, and Excel are supported today.`
      );
    default:
      throw new Error(`Unknown connector kind: ${kind}`);
  }
}

