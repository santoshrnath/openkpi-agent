import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export interface SuggestedKpi {
  definition: string;
  formula: string;
  limitations: string;
  domain: "FINANCE" | "HR" | "PROCUREMENT" | "OPERATIONS" | "SALES" | "DATA" | "CUSTOM";
  ownerHint: string;
  sourceSystemHint: string;
  refreshFrequencyHint: string;
  goodWhenUp: boolean;
  confidenceHint: number;
}

/**
 * Ask Claude to fill plausible documentation for a barely-documented KPI.
 * Used by:
 *   - Per-KPI "Suggest with AI" button
 *   - Workspace-level "Auto-document missing fields" bulk action
 *
 * The model is told to produce conservative, hedge-y language and to NEVER
 * invent specific source-system names, owner identities, or numeric formulas
 * it can't justify. Output is strict JSON.
 */
export async function suggestKpiDocs(input: {
  name: string;
  value?: number | null;
  previousValue?: number | null;
  unit?: string | null;
  workspaceName?: string | null;
  existing?: { definition?: string; formula?: string; limitations?: string };
}): Promise<SuggestedKpi & { model: string; provider: "anthropic"; usage: { input: number; output: number } }> {
  const c = getClient();

  const system = `You are OpenKPI Agent. The user is documenting a KPI in their analytics workspace. They provided minimal info — usually just the KPI name and a value. Your job is to draft PLAUSIBLE, HEDGED documentation that a steward can later verify and certify.

Output STRICT JSON matching this TypeScript shape and nothing else:

{
  "definition": string,            // 1-2 sentences. Plain business English. Start with the KPI's name in normal noun form.
  "formula": string,               // 1 line of pseudocode (e.g. "Sum(orders.amount) where status = 'paid'") OR a plain-English calculation if the math is obvious.
  "limitations": string,           // 1-2 sentences listing what this KPI does NOT capture (exclusions, edge cases).
  "domain": "FINANCE" | "HR" | "PROCUREMENT" | "OPERATIONS" | "SALES" | "DATA" | "CUSTOM",
  "ownerHint": string,             // role/title, never a person's name. e.g. "FP&A team" or "Head of Customer Ops".
  "sourceSystemHint": string,      // a category, never a specific tool branded by the user. e.g. "HRIS", "ERP", "CRM", "warehouse query".
  "refreshFrequencyHint": "Real-time" | "Hourly" | "Daily" | "Weekly" | "Monthly" | "Quarterly",
  "goodWhenUp": boolean,           // true if higher is better (revenue, retention); false if lower is better (attrition, cycle time, cost).
  "confidenceHint": number         // 0..100. How confident the suggestion is in absence of any context. Default ~70.
}

Strict rules:
- NEVER invent owner NAMES or specific source tool names (no 'Workday', no 'Anaya Patel'). Use roles and categories.
- If the KPI name suggests it's a cost/risk metric (cost, leakage, error, churn, time-to-X), goodWhenUp must be false.
- If the user provided existing definition / formula / limitations, do not overwrite — return the existing values verbatim.
- Keep all strings under 280 chars.`;

  const userMsg = `<kpi>
name: ${input.name}
value: ${input.value ?? "(unknown)"}
previous_value: ${input.previousValue ?? "(unknown)"}
unit: ${input.unit ?? "(unknown)"}
workspace_name: ${input.workspaceName ?? "(unspecified)"}
existing_definition: ${input.existing?.definition ?? ""}
existing_formula: ${input.existing?.formula ?? ""}
existing_limitations: ${input.existing?.limitations ?? ""}
</kpi>

Draft the documentation.`;

  const resp = await c.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const cleaned = text.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as SuggestedKpi;

  return {
    ...parsed,
    model: DEFAULT_MODEL,
    provider: "anthropic",
    usage: { input: resp.usage.input_tokens, output: resp.usage.output_tokens },
  };
}
