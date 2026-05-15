/* eslint-disable no-console */
/**
 * Seed script — creates a "demo" workspace with the original sample KPIs and
 * lineage flows. Idempotent: safe to re-run.
 *
 *   npx tsx prisma/seed.ts
 *
 * The data is inlined here so the seed runs cleanly inside the production
 * standalone image (which does not contain src/lib/data).
 */
import { PrismaClient, KpiStatus, KpiDomain, KpiTrend, KpiUnit, LineageKind } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedKpi {
  slug: string;
  name: string;
  domain: KpiDomain;
  value: number;
  previousValue: number;
  unit: KpiUnit;
  goodWhenUp: boolean;
  trend: KpiTrend;
  status: KpiStatus;
  owner: string;
  sourceSystem: string;
  refreshFrequency: string;
  confidenceScore: number;
  definition: string;
  formula: string;
  limitations: string;
  whyMoved: string;
  relatedDashboards: string[];
  relatedKpiSlugs: string[];
  historyBase: number;
  historyShape: "rising" | "falling" | "volatile" | "flat" | "dip";
  historyStep: number;
  historyScale?: number;
}

function makeHistory(base: number, shape: SeedKpi["historyShape"], step: number, scale = 1) {
  const months = ["Aug 25","Sep 25","Oct 25","Nov 25","Dec 25","Jan 26","Feb 26","Mar 26","Apr 26","May 26"];
  return months.map((m, i) => {
    let v = base;
    if (shape === "rising") v = base + step * i;
    if (shape === "falling") v = base - step * i;
    if (shape === "volatile") v = base + Math.sin(i * 1.2) * step * 2;
    if (shape === "flat") v = base;
    if (shape === "dip") v = base + step * i - (i === 5 ? step * 4 : 0) - (i === 6 ? step * 3 : 0);
    return { period: m, value: Number((v * scale).toFixed(2)) };
  });
}

const SEED_KPIS: SeedKpi[] = [
  {
    slug: "revenue-growth", name: "Revenue Growth", domain: KpiDomain.FINANCE,
    value: 12.4, previousValue: 9.8, unit: KpiUnit.PERCENT, goodWhenUp: true,
    trend: KpiTrend.UP, status: KpiStatus.CERTIFIED,
    owner: "Priya Raman — FP&A", sourceSystem: "Salesforce / Certinia",
    refreshFrequency: "Monthly", confidenceScore: 96,
    definition: "Year-over-year percentage growth in recognised revenue across all booking entities. Net of credits and post-period adjustments.",
    formula: "(Current Period Revenue − Prior Period Revenue) / Prior Period Revenue × 100",
    limitations: "Excludes intercompany eliminations finalised after T+5. FX rates use month-end spot — translation differences may appear vs. budget.",
    whyMoved: "Enterprise renewal cohort in EMEA closed early in the period, lifting recurring revenue by 3.1 pts. Offset by a 0.5 pt drop in Professional Services.",
    relatedDashboards: ["Finance Exec Dashboard", "Board Pack — Revenue"],
    relatedKpiSlugs: ["forecast-accuracy", "customer-retention"],
    historyBase: 8, historyShape: "rising", historyStep: 0.6,
  },
  {
    slug: "attrition-rate", name: "Attrition Rate", domain: KpiDomain.HR,
    value: 11.2, previousValue: 13.6, unit: KpiUnit.PERCENT, goodWhenUp: false,
    trend: KpiTrend.DOWN, status: KpiStatus.CERTIFIED,
    owner: "Marcus Lee — People Analytics", sourceSystem: "Workday",
    refreshFrequency: "Monthly", confidenceScore: 92,
    definition: "Percentage of employees who left during the period compared to average headcount.",
    formula: "Leavers / Average Headcount × 100",
    limitations: "Excludes internal transfers and contingent workers. Annualised number uses trailing-12-month leaver totals.",
    whyMoved: "Q1 retention bonuses landed in March; voluntary exits in Engineering dropped 38%. Involuntary attrition rose slightly due to a Sales performance cycle.",
    relatedDashboards: ["People Dashboard", "Talent Risk Cockpit"],
    relatedKpiSlugs: ["workforce-cost", "utilisation"],
    historyBase: 13, historyShape: "falling", historyStep: 0.25,
  },
  {
    slug: "workforce-cost", name: "Workforce Cost", domain: KpiDomain.HR,
    value: 184320000, previousValue: 178900000, unit: KpiUnit.CURRENCY, goodWhenUp: false,
    trend: KpiTrend.UP, status: KpiStatus.CERTIFIED,
    owner: "Priya Raman — FP&A", sourceSystem: "SAP",
    refreshFrequency: "Monthly", confidenceScore: 94,
    definition: "Total fully-loaded employee cost including salary, benefits, employer taxes, and equity expense.",
    formula: "Σ (Base Pay + Variable Comp + Benefits + Employer Taxes + Equity Expense)",
    limitations: "Equity expense uses Black-Scholes assumptions reset quarterly. Contingent labour reported separately in Procurement Spend.",
    whyMoved: "Net new hires in Engineering and Customer Success added $3.8M. April merit cycle contributed $1.6M of structural lift.",
    relatedDashboards: ["Workforce P&L", "Finance Exec Dashboard"],
    relatedKpiSlugs: ["attrition-rate", "utilisation"],
    historyBase: 178, historyShape: "rising", historyStep: 0.9, historyScale: 1_000_000,
  },
  {
    slug: "utilisation", name: "Utilisation", domain: KpiDomain.OPERATIONS,
    value: 78.6, previousValue: 74.2, unit: KpiUnit.PERCENT, goodWhenUp: true,
    trend: KpiTrend.UP, status: KpiStatus.DRAFT,
    owner: "Ifeoma Adeyemi — Delivery Ops", sourceSystem: "Salesforce / Certinia",
    refreshFrequency: "Weekly", confidenceScore: 81,
    definition: "Billable hours as a percentage of available hours across consulting and delivery teams.",
    formula: "Billable Hours / (Available Hours − Approved Time Off) × 100",
    limitations: "Draft — currently excludes apprentice cohort. Timesheets locked T+3, so the latest week is provisional.",
    whyMoved: "Two large EMEA programmes started ramp in April, lifting billable hours by ~9,400. Bench size reduced from 41 to 28 consultants.",
    relatedDashboards: ["Delivery Ops Cockpit", "Practice P&L"],
    relatedKpiSlugs: ["revenue-growth", "workforce-cost"],
    historyBase: 72, historyShape: "rising", historyStep: 0.7,
  },
  {
    slug: "procurement-spend", name: "Procurement Spend", domain: KpiDomain.PROCUREMENT,
    value: 62400000, previousValue: 58900000, unit: KpiUnit.CURRENCY, goodWhenUp: false,
    trend: KpiTrend.UP, status: KpiStatus.CERTIFIED,
    owner: "Raphael Costa — Procurement", sourceSystem: "Coupa",
    refreshFrequency: "Weekly", confidenceScore: 89,
    definition: "Total committed spend across approved purchase orders and invoices, excluding payroll and intercompany.",
    formula: "Σ (PO Commitments + Non-PO Invoices) − Intercompany",
    limitations: "Marketing campaign commitments classified under indirect spend can lag by ~5 business days from contract signature.",
    whyMoved: "Cloud infrastructure renewal pulled $2.1M forward into April; professional services committed for the data platform programme added $1.4M.",
    relatedDashboards: ["Procurement Dashboard", "Supplier Risk Board"],
    relatedKpiSlugs: ["supplier-approval-cycle", "workforce-cost"],
    historyBase: 58, historyShape: "rising", historyStep: 0.55, historyScale: 1_000_000,
  },
  {
    slug: "supplier-approval-cycle", name: "Supplier Approval Cycle", domain: KpiDomain.PROCUREMENT,
    value: 7.8, previousValue: 11.2, unit: KpiUnit.DAYS, goodWhenUp: false,
    trend: KpiTrend.DOWN, status: KpiStatus.CERTIFIED,
    owner: "Raphael Costa — Procurement", sourceSystem: "Coupa",
    refreshFrequency: "Weekly", confidenceScore: 90,
    definition: "Median number of business days between supplier onboarding request and final approval.",
    formula: "Median(Approval Date − Request Date) over completed onboardings",
    limitations: "Excludes suppliers escalated to Legal — those follow a separate workflow with its own SLA.",
    whyMoved: "New parallel-approval workflow shipped in mid-March cut average wait time by 2.6 days. Risk-tier matrix removed redundant InfoSec review for low-risk vendors.",
    relatedDashboards: ["Procurement Dashboard"],
    relatedKpiSlugs: ["procurement-spend"],
    historyBase: 12, historyShape: "falling", historyStep: 0.35,
  },
  {
    slug: "customer-retention", name: "Customer Retention", domain: KpiDomain.SALES,
    value: 94.2, previousValue: 92.8, unit: KpiUnit.PERCENT, goodWhenUp: true,
    trend: KpiTrend.UP, status: KpiStatus.CERTIFIED,
    owner: "Anaya Patel — Revenue Ops", sourceSystem: "Salesforce / Certinia",
    refreshFrequency: "Monthly", confidenceScore: 93,
    definition: "Gross revenue retention from customers at the start of the period, before expansion.",
    formula: "(Starting ARR − Churned ARR − Downgrade ARR) / Starting ARR × 100",
    limitations: "Customers with active legal disputes are excluded from the cohort to avoid skewing the trend.",
    whyMoved: "Top-100 account programme reduced churn by 0.9 pts. One mid-market account ($1.1M ARR) downgraded but did not churn.",
    relatedDashboards: ["Revenue Ops Dashboard", "QBR Pack"],
    relatedKpiSlugs: ["revenue-growth", "sla-compliance"],
    historyBase: 92, historyShape: "rising", historyStep: 0.18,
  },
  {
    slug: "sla-compliance", name: "SLA Compliance", domain: KpiDomain.OPERATIONS,
    value: 96.4, previousValue: 97.9, unit: KpiUnit.PERCENT, goodWhenUp: true,
    trend: KpiTrend.DOWN, status: KpiStatus.NEEDS_REVIEW,
    owner: "Hugo Bernard — Customer Ops", sourceSystem: "SQL Database",
    refreshFrequency: "Daily", confidenceScore: 72,
    definition: "Percentage of customer tickets resolved within their contractual SLA window.",
    formula: "Tickets Resolved Within SLA / Total Tickets Closed × 100",
    limitations: "Currently includes auto-closed tickets, which may inflate the number. Needs review by Customer Ops before Board reporting.",
    whyMoved: "Two P1 incidents in mid-April breached SLA on 132 tickets. Backlog from EU region not fully cleared during May 1 holiday week.",
    relatedDashboards: ["Customer Ops Cockpit"],
    relatedKpiSlugs: ["customer-retention"],
    historyBase: 98, historyShape: "dip", historyStep: 0.3,
  },
  {
    slug: "forecast-accuracy", name: "Forecast Accuracy", domain: KpiDomain.FINANCE,
    value: 91.7, previousValue: 88.4, unit: KpiUnit.PERCENT, goodWhenUp: true,
    trend: KpiTrend.UP, status: KpiStatus.CERTIFIED,
    owner: "Priya Raman — FP&A", sourceSystem: "TM1 / IBM Planning Analytics",
    refreshFrequency: "Monthly", confidenceScore: 88,
    definition: "Inverse mean absolute percentage error between revenue forecast (T-1 month) and actuals.",
    formula: "100 − Mean(|Forecast − Actual| / Actual × 100)",
    limitations: "Computed only on top-30 deals by ARR. Long-tail SMB segment is forecast in aggregate.",
    whyMoved: "New ML-assisted late-stage scoring reduced over-forecasting on commit deals; April actuals landed within 2.1% of submitted forecast.",
    relatedDashboards: ["FP&A Dashboard", "Board Pack — Revenue"],
    relatedKpiSlugs: ["revenue-growth"],
    historyBase: 86, historyShape: "rising", historyStep: 0.55,
  },
  {
    slug: "data-quality-score", name: "Data Quality Score", domain: KpiDomain.DATA,
    value: 84.5, previousValue: 81.2, unit: KpiUnit.SCORE, goodWhenUp: true,
    trend: KpiTrend.UP, status: KpiStatus.DRAFT,
    owner: "Sara Khalid — Data Governance", sourceSystem: "SQL Database",
    refreshFrequency: "Daily", confidenceScore: 78,
    definition: "Composite score across completeness, freshness, accuracy, and conformity tests on certified data products.",
    formula: "Weighted average of test pass-rates: Completeness (0.3) + Freshness (0.3) + Accuracy (0.25) + Conformity (0.15)",
    limitations: "Draft — Conformity weight under review. New Procurement domain not yet onboarded into the test suite.",
    whyMoved: "Two stale data products fixed (Finance recurring revenue cube, HR position data). Adding 14 new freshness checks reduced silent staleness in dashboards.",
    relatedDashboards: ["Data Governance Dashboard"],
    relatedKpiSlugs: ["forecast-accuracy", "sla-compliance"],
    historyBase: 80, historyShape: "rising", historyStep: 0.5,
  },
];

const SEED_LINEAGES = [
  {
    kpiSlug: "procurement-spend",
    steps: [
      { label: "Coupa", detail: "Source of truth for POs, invoices and supplier master.", kind: LineageKind.SOURCE },
      { label: "SQL Staging", detail: "Nightly extract of POs, invoices, supplier records into raw schema.", kind: LineageKind.STAGING },
      { label: "Spend Transformation", detail: "Currency conversion, intercompany elimination, GL mapping.", kind: LineageKind.TRANSFORM },
      { label: "Procurement Semantic Model", detail: "Certified business definitions, hierarchies, calculated measures.", kind: LineageKind.SEMANTIC },
      { label: "Procurement Dashboard", detail: "Power BI workspace consumed by Finance leadership.", kind: LineageKind.DASHBOARD },
      { label: "Procurement Spend", detail: "Certified KPI reported in monthly board pack.", kind: LineageKind.KPI },
    ],
  },
  {
    kpiSlug: "attrition-rate",
    steps: [
      { label: "Workday", detail: "Authoritative HRIS for headcount, joiners, leavers, position data.", kind: LineageKind.SOURCE },
      { label: "SQL Staging", detail: "Daily snapshots of worker, job, and position objects.", kind: LineageKind.STAGING },
      { label: "Headcount Transformation", detail: "Calendarised headcount, leaver classification, dedupe of internal transfers.", kind: LineageKind.TRANSFORM },
      { label: "People Semantic Model", detail: "Certified business hierarchy: legal entity, region, function, level.", kind: LineageKind.SEMANTIC },
      { label: "People Dashboard", detail: "Talent Risk Cockpit + monthly People Review pack.", kind: LineageKind.DASHBOARD },
      { label: "Attrition Rate", detail: "Certified KPI reviewed monthly by CPO and CEO staff.", kind: LineageKind.KPI },
    ],
  },
  {
    kpiSlug: "revenue-growth",
    steps: [
      { label: "Salesforce / Certinia", detail: "Bookings, contracts, billings and revenue recognition events.", kind: LineageKind.SOURCE },
      { label: "SQL Staging", detail: "CDC stream landed into raw, deduped, conformed.", kind: LineageKind.STAGING },
      { label: "Revenue Transformation", detail: "ASC 606 schedule materialisation, FX translation, eliminations.", kind: LineageKind.TRANSFORM },
      { label: "Finance Semantic Model", detail: "Single source of truth for GAAP & non-GAAP revenue measures.", kind: LineageKind.SEMANTIC },
      { label: "Finance Exec Dashboard", detail: "Board pack, CFO review, FP&A operating cadence.", kind: LineageKind.DASHBOARD },
      { label: "Revenue Growth", detail: "Certified board-grade KPI.", kind: LineageKind.KPI },
    ],
  },
];

async function main() {
  console.log("→ Seeding 'demo' workspace…");

  const ws = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "OpenKPI Demo",
      tagline: "AI-powered KPI intelligence — sample workspace",
      currency: "USD",
    },
  });

  for (const k of SEED_KPIS) {
    const history = makeHistory(k.historyBase, k.historyShape, k.historyStep, k.historyScale ?? 1);
    const data = {
      name: k.name, domain: k.domain,
      value: k.value, previousValue: k.previousValue, unit: k.unit,
      goodWhenUp: k.goodWhenUp, trend: k.trend, status: k.status,
      owner: k.owner, sourceSystem: k.sourceSystem,
      refreshFrequency: k.refreshFrequency,
      lastRefresh: new Date(), confidenceScore: k.confidenceScore,
      definition: k.definition, formula: k.formula,
      limitations: k.limitations, whyMoved: k.whyMoved,
      relatedDashboards: k.relatedDashboards,
      relatedKpiSlugs: k.relatedKpiSlugs,
    };
    const kpi = await prisma.kpi.upsert({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: k.slug } },
      update: data,
      create: { workspaceId: ws.id, slug: k.slug, ...data },
    });
    await prisma.kpiHistoryPoint.deleteMany({ where: { kpiId: kpi.id } });
    await prisma.kpiHistoryPoint.createMany({
      data: history.map((p) => ({ kpiId: kpi.id, period: p.period, value: p.value })),
    });
  }

  for (const flow of SEED_LINEAGES) {
    const kpi = await prisma.kpi.findUnique({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: flow.kpiSlug } },
    });
    if (!kpi) continue;
    const lf = await prisma.lineageFlow.upsert({
      where: { kpiId: kpi.id },
      update: {},
      create: { workspaceId: ws.id, kpiId: kpi.id },
    });
    await prisma.lineageStep.deleteMany({ where: { flowId: lf.id } });
    await prisma.lineageStep.createMany({
      data: flow.steps.map((s, i) => ({
        flowId: lf.id, ordinal: i, label: s.label, detail: s.detail,
        kind: s.kind, status: "Active",
      })),
    });
  }

  console.log(`✓ Seeded ${SEED_KPIS.length} KPIs and ${SEED_LINEAGES.length} lineage flows into workspace '${ws.slug}'.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
