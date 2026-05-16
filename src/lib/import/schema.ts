/**
 * Canonical CSV schema for KPI imports.
 *
 * Column names are matched case-insensitively. We accept the canonical form
 * plus a handful of common aliases — users routinely arrive with headers like
 * "KPI Name", "Metric", "Current Value", "Source", etc.
 */
export interface ImportField {
  key: string;
  required: boolean;
  aliases: string[];
  /** human-readable description for error messages and the docs panel */
  doc: string;
}

export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "name",
    required: true,
    aliases: ["name", "kpi", "kpi name", "metric", "metric name", "title"],
    doc: "Human-readable KPI name. Used for display and search. Required.",
  },
  {
    key: "domain",
    required: false,
    aliases: ["domain", "function", "department", "area"],
    doc: "One of: Finance, HR, Procurement, Operations, Sales, Data. Defaults to Finance.",
  },
  {
    key: "value",
    required: true,
    aliases: ["value", "current value", "current", "latest value", "latest", "now"],
    doc: "Current period value (number). Required.",
  },
  {
    key: "previous_value",
    required: false,
    aliases: ["previous_value", "previous value", "prior value", "prior", "last period", "yoy"],
    doc: "Prior period value. If omitted, change/trend default to 0/flat.",
  },
  {
    key: "unit",
    required: false,
    aliases: ["unit", "type", "format"],
    doc: "One of: % | $ | days | score | ratio | count. Defaults to count.",
  },
  {
    key: "good_when_up",
    required: false,
    aliases: ["good_when_up", "good when up", "higher is better", "direction", "polarity"],
    doc: "true / false / up / down. Whether an increase is good. Defaults to true.",
  },
  {
    key: "status",
    required: false,
    aliases: ["status", "certification", "governance"],
    doc: "Certified | Draft | Needs Review. Defaults to Draft.",
  },
  {
    key: "owner",
    required: false,
    aliases: ["owner", "steward", "data owner", "responsible"],
    doc: "Person or team accountable for this KPI.",
  },
  {
    key: "source_system",
    required: false,
    aliases: ["source_system", "source system", "source", "system", "origin"],
    doc: "Where the data comes from (Workday, SAP, Salesforce, SQL, Excel, etc.).",
  },
  {
    key: "refresh_frequency",
    required: false,
    aliases: ["refresh_frequency", "refresh frequency", "cadence", "frequency", "refresh"],
    doc: "Daily | Weekly | Monthly | Quarterly | Real-time. Defaults to Monthly.",
  },
  {
    key: "confidence_score",
    required: false,
    aliases: ["confidence_score", "confidence score", "confidence", "quality"],
    doc: "Integer 0–100. Defaults to 70.",
  },
  {
    key: "definition",
    required: false,
    aliases: ["definition", "description", "what is this", "meaning"],
    doc: "Business definition of the KPI.",
  },
  {
    key: "formula",
    required: false,
    aliases: ["formula", "calculation", "math", "how is it calculated"],
    doc: "Plain-text or pseudocode formula.",
  },
  {
    key: "limitations",
    required: false,
    aliases: ["limitations", "caveats", "known issues", "watchouts"],
    doc: "What this KPI does NOT capture, edge cases, exclusions.",
  },
  {
    key: "why_moved",
    required: false,
    aliases: ["why_moved", "why moved", "narrative", "commentary", "explanation"],
    doc: "Latest narrative for why the value changed period-over-period.",
  },
];

/** lowercase header → canonical key, with aliases expanded */
export function buildAliasMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of IMPORT_FIELDS) {
    for (const a of f.aliases) m.set(a.toLowerCase().trim(), f.key);
  }
  return m;
}

export const SAMPLE_CSV = [
  "name,domain,value,previous_value,unit,good_when_up,status,owner,source_system,refresh_frequency,confidence_score,definition,formula,limitations,why_moved",
  `Revenue Growth,Finance,12.4,9.8,%,true,Certified,Priya Raman — FP&A,Salesforce,Monthly,96,"Year-over-year percentage growth in recognised revenue across all booking entities.","(Current − Prior) / Prior × 100","Excludes intercompany eliminations finalised after T+5.","Enterprise renewals in EMEA closed early; offset by a 0.5 pt drop in Professional Services."`,
  `Attrition Rate,HR,11.2,13.6,%,false,Certified,Marcus Lee — People Analytics,Workday,Monthly,92,"Percentage of employees who left during the period compared to average headcount.","Leavers / Average Headcount × 100","Excludes internal transfers and contingent workers.","Q1 retention bonuses landed in March; voluntary exits in Engineering dropped 38%."`,
  `Procurement Spend,Procurement,62400000,58900000,$,false,Certified,Raphael Costa — Procurement,Coupa,Weekly,89,"Total committed spend across approved POs and invoices, excluding payroll and intercompany.","Σ (PO Commitments + Non-PO Invoices) − Intercompany","Indirect spend may lag ~5 business days from contract signature.","Cloud renewal pulled $2.1M forward; data platform programme added $1.4M."`,
  `Customer Retention,Sales,94.2,92.8,%,true,Certified,Anaya Patel — Revenue Ops,Salesforce,Monthly,93,"Gross revenue retention from customers at the start of the period, before expansion.","(Starting ARR − Churned − Downgrade) / Starting ARR × 100","Customers in active legal disputes are excluded.","Top-100 account programme reduced churn by 0.9 pts."`,
].join("\n");
