import { AIResponse, KPI } from "@/types";
import { formatKPIValue } from "./utils";

type Intent =
  | "definition"
  | "formula"
  | "movement"
  | "source"
  | "trust"
  | "next"
  | "compare"
  | "generic";

function classify(question: string): Intent {
  const q = question.toLowerCase();
  if (/mean|definition|what is|describe/.test(q)) return "definition";
  if (/calc|formula|how is .* (computed|calculated)/.test(q)) return "formula";
  if (/why|move|drop|spike|change|increase|decrease/.test(q)) return "movement";
  if (/source|system|where.*from/.test(q)) return "source";
  if (/trust|certif|accura|reliab|confidence/.test(q)) return "trust";
  if (/next|action|do/.test(q)) return "next";
  if (/compare|vs|benchmark/.test(q)) return "compare";
  return "generic";
}

export function generateMockAIResponse(
  question: string,
  kpi: KPI | undefined
): AIResponse {
  const intent = classify(question);
  if (!kpi) {
    return {
      answer:
        "Select a KPI from the catalog and I'll explain its definition, lineage, recent movement and assumptions.",
      sources: [],
      confidence: 0,
      assumptions: ["No KPI was selected."],
      followUps: [
        "Open the KPI Catalog",
        "Show me Revenue Growth",
        "What does Attrition Rate mean?",
      ],
    };
  }

  const valueStr = formatKPIValue(kpi.value, kpi.unit);
  const prevStr = formatKPIValue(kpi.previousValue, kpi.unit);

  switch (intent) {
    case "definition":
      return {
        answer: `${kpi.name} is ${kpi.definition}`,
        sources: [
          `OpenKPI Knowledge Layer — kpi:${kpi.id}`,
          `Owner: ${kpi.owner}`,
        ],
        confidence: kpi.confidenceScore,
        assumptions: [
          `Refreshed ${kpi.refreshFrequency.toLowerCase()} from ${kpi.sourceSystem}.`,
          kpi.limitations,
        ],
        followUps: [
          `How is ${kpi.name} calculated?`,
          `Why did ${kpi.name} move?`,
          `Can leadership trust ${kpi.name}?`,
        ],
      };
    case "formula":
      return {
        answer: `${kpi.name} is calculated as: ${kpi.formula}. Current period: ${valueStr} vs prior period ${prevStr}.`,
        sources: [
          `Semantic Model — ${kpi.sourceSystem}`,
          `Definition certified by ${kpi.owner}`,
        ],
        confidence: kpi.confidenceScore,
        assumptions: [kpi.limitations],
        followUps: [
          `What systems feed ${kpi.name}?`,
          `Show me the lineage`,
          `Are there exclusions I should know about?`,
        ],
      };
    case "movement":
      return {
        answer: `${kpi.name} moved from ${prevStr} to ${valueStr}. ${kpi.whyMoved}`,
        sources: [
          `Trend history — last 10 periods`,
          `${kpi.sourceSystem} transactional detail`,
        ],
        confidence: Math.max(60, kpi.confidenceScore - 8),
        assumptions: [
          "Driver analysis is a directional decomposition, not a controlled experiment.",
          kpi.limitations,
        ],
        followUps: [
          `Which segments drove the change?`,
          `Is the move sustainable?`,
          `What should I check next?`,
        ],
      };
    case "source":
      return {
        answer: `${kpi.name} is sourced from ${kpi.sourceSystem}, refreshed ${kpi.refreshFrequency.toLowerCase()}, last updated ${kpi.lastRefresh}. Owner: ${kpi.owner}.`,
        sources: [`${kpi.sourceSystem}`, `Refresh job: kpi_${kpi.id}_refresh`],
        confidence: kpi.confidenceScore,
        assumptions: ["Lineage as registered in OpenKPI's knowledge layer."],
        followUps: [
          `Show me the full lineage`,
          `Who owns ${kpi.name}?`,
          `What is the refresh cadence?`,
        ],
      };
    case "trust":
      return {
        answer:
          kpi.status === "Certified"
            ? `${kpi.name} is Certified by ${kpi.owner} with a confidence score of ${kpi.confidenceScore}. It is safe for board-level reporting, with the caveat below.`
            : `${kpi.name} is currently ${kpi.status}. Confidence: ${kpi.confidenceScore}. Treat with care in executive reporting until a steward signs off.`,
        sources: [
          `Governance status: ${kpi.status}`,
          `Confidence model — freshness, completeness, definition stability`,
        ],
        confidence: kpi.confidenceScore,
        assumptions: [kpi.limitations],
        followUps: [
          `What lowers the confidence?`,
          `Who owns ${kpi.name}?`,
          `How can we get this certified?`,
        ],
      };
    case "next":
      return {
        answer: `For ${kpi.name}, I would (1) validate the driver analysis with ${kpi.owner}, (2) review limitations — ${kpi.limitations}, and (3) check related KPIs: ${kpi.relatedKPIs.join(", ")}.`,
        sources: [
          `OpenKPI playbook: KPI review`,
          `Related KPIs: ${kpi.relatedKPIs.join(", ")}`,
        ],
        confidence: 80,
        assumptions: [
          "Suggested actions are heuristics generated from the KPI's governance metadata.",
        ],
        followUps: [
          `What dashboards consume ${kpi.name}?`,
          `Show me the lineage`,
          `Generate executive brief`,
        ],
      };
    case "compare":
      return {
        answer: `${kpi.name} moved ${kpi.change > 0 ? "+" : ""}${kpi.change} ${kpi.unit === "%" ? "pts" : kpi.unit} vs prior period (${prevStr} → ${valueStr}). Related KPIs to triangulate against: ${kpi.relatedKPIs.join(", ")}.`,
        sources: [
          `Trend series — kpi:${kpi.id}`,
          `Related KPIs: ${kpi.relatedKPIs.join(", ")}`,
        ],
        confidence: kpi.confidenceScore,
        assumptions: ["External benchmarks not available in MVP."],
        followUps: [
          `Why did it move?`,
          `Show me the lineage`,
          `What are the assumptions?`,
        ],
      };
    default:
      return {
        answer: `Here's what I know about ${kpi.name}: ${kpi.definition} It currently reads ${valueStr} (prior ${prevStr}). Owner: ${kpi.owner}. Status: ${kpi.status}.`,
        sources: [
          `OpenKPI Knowledge Layer — kpi:${kpi.id}`,
          `${kpi.sourceSystem}`,
        ],
        confidence: kpi.confidenceScore,
        assumptions: [kpi.limitations],
        followUps: [
          `Why did ${kpi.name} move?`,
          `How is ${kpi.name} calculated?`,
          `Can leadership trust ${kpi.name}?`,
        ],
      };
  }
}

export function explainExpression(expr: string): {
  language: "DAX" | "SQL" | "Unknown";
  explanation: string;
  bullets: string[];
  caveats: string[];
} {
  const text = expr.trim();
  if (!text) {
    return {
      language: "DAX",
      explanation:
        "Paste a DAX or SQL expression and I'll translate it into plain English. Try the example button below.",
      bullets: [],
      caveats: [],
    };
  }

  const isDax =
    /CALCULATE|TOTALYTD|SUMX|FILTER|DAX|RELATED|VAR\s+\w+\s*=|EARLIER|DIVIDE\(/i.test(
      text
    );
  const isSql = /\bSELECT\b|\bFROM\b|\bJOIN\b|\bWHERE\b|\bGROUP BY\b/i.test(text);

  if (isDax) {
    const bullets: string[] = [];
    if (/TOTALYTD/i.test(text))
      bullets.push(
        "TOTALYTD walks from the start of the selected fiscal year up to the current date filter context."
      );
    if (/CALCULATE/i.test(text))
      bullets.push(
        "CALCULATE re-evaluates the inner expression after replacing or adjusting the current filter context."
      );
    if (/SUM\(/i.test(text))
      bullets.push("SUM aggregates the column over the active row context.");
    if (/DIVIDE\(/i.test(text))
      bullets.push("DIVIDE returns 0 (or BLANK) when the denominator is zero — safer than `/`.");
    if (bullets.length === 0)
      bullets.push("Standard DAX measure evaluated in the current filter context.");

    return {
      language: "DAX",
      explanation:
        "This is a DAX measure. It produces a single scalar value evaluated against the current filter context of the report (e.g. the slicers, axis, and row currently in scope).",
      bullets,
      caveats: [
        "Filter context is implicit — moving this measure to a different visual will change its result.",
        "Verify date table relationships are marked as a Date table for time-intelligence functions to work.",
      ],
    };
  }

  if (isSql) {
    const bullets: string[] = [];
    if (/\bGROUP BY\b/i.test(text))
      bullets.push("Aggregates rows into groups defined by the GROUP BY columns.");
    if (/\bJOIN\b/i.test(text))
      bullets.push("Joins multiple tables — confirm grain to avoid row inflation.");
    if (/\bWHERE\b/i.test(text))
      bullets.push("WHERE filters before aggregation.");
    if (/\bHAVING\b/i.test(text))
      bullets.push("HAVING filters after aggregation.");
    if (bullets.length === 0)
      bullets.push("Standard projection query — selects columns from one or more tables.");
    return {
      language: "SQL",
      explanation:
        "This is a SQL query. It produces a result set — confirm the grain of the output (one row per…?) before consuming it in a KPI.",
      bullets,
      caveats: [
        "Joins may inflate row counts if the join key is not unique on the right side.",
        "Time zone of date columns affects period-over-period comparisons.",
      ],
    };
  }

  return {
    language: "Unknown",
    explanation:
      "The expression doesn't clearly match DAX or SQL patterns. The MVP supports those two languages — extend the prompt for other dialects.",
    bullets: [],
    caveats: [],
  };
}
