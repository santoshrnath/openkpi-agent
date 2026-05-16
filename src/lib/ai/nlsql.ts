import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { renderSchemaForPrompt, SchemaSnapshot } from "@/lib/connectors/schema";

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export interface NlSqlDraft {
  sql: string;
  explanation: string;
  model: string;
  usage: { input: number; output: number };
}

/**
 * Turns a natural-language question into a single read-only SQL statement
 * grounded in the connector's schema. Returns the SQL plus a one-sentence
 * plain-English explanation. The caller is responsible for executing the
 * SQL — this function does NOT touch the database.
 */
export async function draftSqlFromQuestion(
  question: string,
  snap: SchemaSnapshot,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<NlSqlDraft> {
  const c = getClient();
  const schemaText = renderSchemaForPrompt(snap);

  const system = `You are OpenKPI Studio's SQL author. Translate the user's question into ONE valid SQL statement against the schema below.

RULES — non-negotiable:
- Output STRICT JSON: {"sql": string, "explanation": string}. Nothing else, no fences.
- "sql" must be a single statement, no trailing semicolons, no DDL/DML — only SELECT (or WITH ... SELECT, or EVALUATE for DAX).
- Never write INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE, CREATE, GRANT, REVOKE, EXEC, CALL.
- Use ONLY tables and columns that appear in the schema. If the question needs something not in the schema, set "sql" to "" and "explanation" to a one-sentence reason.
- Match the dialect exactly. For MSSQL use TOP N, never LIMIT. For Postgres/Snowflake/BigQuery use LIMIT.
- Default to row limits (TOP 100 / LIMIT 100) when the user doesn't specify.
- "explanation" must be ONE sentence, plain English, naming the table(s) and aggregation used.

Schema:
${schemaText}`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history,
    { role: "user", content: question },
  ];

  const resp = await c.messages.create({
    model: MODEL,
    max_tokens: 800,
    system,
    messages,
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  let parsed: { sql?: string; explanation?: string };
  try {
    const cleaned = text.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { sql: "", explanation: text.slice(0, 200) || "Model did not return valid JSON." };
  }

  return {
    sql: (parsed.sql ?? "").trim(),
    explanation: parsed.explanation ?? "",
    model: MODEL,
    usage: { input: resp.usage.input_tokens, output: resp.usage.output_tokens },
  };
}

/**
 * Last-line defense — even though connectors wrap queries in read-only
 * transactions, we still refuse anything that looks like DML on the way in.
 * Returns null when clean, an error string when blocked.
 */
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|MERGE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|CALL)\b/i;
export function validateReadOnlySql(sql: string): string | null {
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
  if (!stripped) return "Empty SQL.";
  if (FORBIDDEN.test(stripped)) return "Refusing to run a non-read-only statement.";
  return null;
}
