import "server-only";
import { SourceKind } from "@prisma/client";
import { decryptJson } from "@/lib/crypto";
import { Connector, ConnectorKind } from "./types";
import { PostgresConnector } from "./postgres";

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
}): Connector {
  if (!row.credentialsCipher) {
    throw new Error("Connection has no credentials configured.");
  }
  const kind = row.kind as ConnectorKind;
  switch (kind) {
    case "POSTGRES": {
      const creds = decryptJson<{ url: string }>(row.credentialsCipher);
      return new PostgresConnector(creds);
    }
    case "MSSQL":
    case "SNOWFLAKE":
    case "BIGQUERY":
    case "SALESFORCE":
    case "COUPA":
    case "WORKDAY":
    case "POWERBI":
    case "SAP":
      throw new Error(
        `${kind} connector is on the roadmap. Postgres is supported today.`
      );
    case "CSV":
    case "EXCEL":
      throw new Error(`${kind} sources use the upload flow, not a connector.`);
    default:
      throw new Error(`Unknown connector kind: ${kind}`);
  }
}

