import { KPI, Domain, KPIStatus, KPITrend, SourceSystem, LineageFlow, LineageStep } from "@/types";
import type { Kpi, KpiHistoryPoint, LineageFlow as DbFlow, LineageStep as DbStep } from "@prisma/client";

const DOMAIN_TO_UI: Record<string, Domain> = {
  FINANCE: "Finance",
  HR: "HR",
  PROCUREMENT: "Procurement",
  OPERATIONS: "Operations",
  SALES: "Sales",
  DATA: "Data",
  CUSTOM: "Finance",
};

const STATUS_TO_UI: Record<string, KPIStatus> = {
  CERTIFIED: "Certified",
  DRAFT: "Draft",
  NEEDS_REVIEW: "Needs Review",
};

const TREND_TO_UI: Record<string, KPITrend> = {
  UP: "up",
  DOWN: "down",
  FLAT: "flat",
};

const UNIT_TO_UI: Record<string, KPI["unit"]> = {
  PERCENT: "%",
  CURRENCY: "$",
  DAYS: "days",
  SCORE: "score",
  RATIO: "ratio",
  COUNT: "count",
};

const KIND_TO_UI: Record<string, LineageStep["kind"]> = {
  SOURCE: "source",
  STAGING: "staging",
  TRANSFORM: "transform",
  SEMANTIC: "semantic",
  DASHBOARD: "dashboard",
  KPI: "kpi",
};

export function dbKpiToUi(
  kpi: Kpi & { history?: KpiHistoryPoint[] }
): KPI {
  return {
    id: kpi.slug,
    name: kpi.name,
    domain: DOMAIN_TO_UI[kpi.domain] ?? "Finance",
    value: kpi.value,
    unit: UNIT_TO_UI[kpi.unit] ?? "ratio",
    previousValue: kpi.previousValue,
    change: kpi.value - kpi.previousValue,
    trend: TREND_TO_UI[kpi.trend] ?? "flat",
    goodWhen: kpi.goodWhenUp ? "up" : "down",
    status: STATUS_TO_UI[kpi.status] ?? "Draft",
    owner: kpi.owner,
    sourceSystem: kpi.sourceSystem as SourceSystem,
    refreshFrequency: (kpi.refreshFrequency as KPI["refreshFrequency"]) ?? "Monthly",
    confidenceScore: kpi.confidenceScore,
    lastRefresh: kpi.lastRefresh ? kpi.lastRefresh.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—",
    definition: kpi.definition,
    formula: kpi.formula,
    relatedDashboards: kpi.relatedDashboards,
    relatedKPIs: kpi.relatedKpiSlugs,
    limitations: kpi.limitations,
    history: (kpi.history ?? []).map((h) => ({ period: h.period, value: h.value })),
    whyMoved: kpi.whyMoved ?? "",
  };
}

export function dbFlowToUi(
  flow: DbFlow & { steps: DbStep[]; kpi: { slug: string; name: string; domain: string } }
): LineageFlow {
  return {
    kpiId: flow.kpi.slug,
    kpiName: flow.kpi.name,
    domain: DOMAIN_TO_UI[flow.kpi.domain] ?? "Finance",
    steps: flow.steps.map((s) => ({
      id: s.id,
      label: s.label,
      detail: s.detail,
      kind: KIND_TO_UI[s.kind] ?? "source",
    })),
  };
}
