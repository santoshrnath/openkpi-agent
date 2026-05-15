import Anthropic from "@anthropic-ai/sdk";
import { AIResponse } from "@/types";

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

interface KpiContext {
  name: string;
  domain: string;
  value: number | string;
  previousValue: number | string;
  unit: string;
  status: string;
  owner: string;
  sourceSystem: string;
  refreshFrequency: string;
  lastRefresh?: string;
  confidenceScore: number;
  definition: string;
  formula: string;
  limitations: string;
  whyMoved?: string;
  relatedDashboards: string[];
  relatedKPIs: string[];
}

/**
 * Grounded KPI explanation. The system prompt is constrained to the KPI's
 * certified metadata so the model cannot invent formulas, owners, or sources.
 * Returns a structured AIResponse the UI already knows how to render.
 */
export async function explainKpiWithAnthropic(
  question: string,
  kpi: KpiContext
): Promise<AIResponse & { model: string; provider: "anthropic"; usage: { input: number; output: number } }> {
  const c = getClient();

  const system = `You are OpenKPI Agent, a grounded enterprise KPI explainer for an analytics team.

You answer ONLY based on the KPI metadata provided in <kpi> below. You must:
- Never invent formulas, source systems, owners, or values that aren't in the metadata.
- Cite specific fields from the metadata when relevant (definition, formula, limitations, source).
- If the user asks about something not in the metadata (a different KPI, a value not shown), say "I don't have that in the certified metadata."
- Be concise — 3-5 short sentences in the answer.
- Use the KPI's "limitations" field as your assumptions list.

Output STRICT JSON matching this TypeScript shape, and nothing else:

{
  "answer": string,           // 3-5 sentences, plain English, grounded
  "sources": string[],        // which metadata fields you used, e.g. ["definition", "formula", "whyMoved"]
  "confidence": number,       // 0..100. Anchor near the KPI's confidenceScore; lower if you had to extrapolate.
  "assumptions": string[],    // start with the KPI's limitations, add anything else implicit
  "followUps": string[]       // 3 suggested next questions
}

<kpi>
name: ${kpi.name}
domain: ${kpi.domain}
status: ${kpi.status}
owner: ${kpi.owner}
sourceSystem: ${kpi.sourceSystem}
refreshFrequency: ${kpi.refreshFrequency}
lastRefresh: ${kpi.lastRefresh ?? "n/a"}
confidenceScore: ${kpi.confidenceScore}
unit: ${kpi.unit}
currentValue: ${kpi.value}
previousValue: ${kpi.previousValue}
definition: ${kpi.definition}
formula: ${kpi.formula}
limitations: ${kpi.limitations}
whyMoved: ${kpi.whyMoved ?? "(no narrative recorded)"}
relatedDashboards: ${kpi.relatedDashboards.join(", ") || "(none)"}
relatedKPIs: ${kpi.relatedKPIs.join(", ") || "(none)"}
</kpi>`;

  const resp = await c.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: question }],
  });

  const text = resp.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("");

  let parsed: Partial<AIResponse>;
  try {
    // Defensive: model sometimes wraps JSON in fences
    const cleaned = text.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback if model didn't comply: return the raw text as the answer.
    parsed = {
      answer: text || "I couldn't produce a grounded answer for that question.",
      sources: [],
      confidence: Math.max(40, kpi.confidenceScore - 20),
      assumptions: [kpi.limitations],
      followUps: [
        `What is ${kpi.name}?`,
        `How is ${kpi.name} calculated?`,
        `Why did ${kpi.name} move?`,
      ],
    };
  }

  return {
    answer: parsed.answer ?? "",
    sources: parsed.sources ?? [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : kpi.confidenceScore,
    assumptions: parsed.assumptions ?? [],
    followUps: parsed.followUps ?? [],
    model: DEFAULT_MODEL,
    provider: "anthropic",
    usage: {
      input: resp.usage.input_tokens,
      output: resp.usage.output_tokens,
    },
  };
}
