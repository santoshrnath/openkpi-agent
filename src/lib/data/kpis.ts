import { KPI } from "@/types";

function makeHistory(
  base: number,
  shape: "rising" | "falling" | "volatile" | "flat" | "dip",
  step = 1
): { period: string; value: number }[] {
  const months = [
    "Aug 25",
    "Sep 25",
    "Oct 25",
    "Nov 25",
    "Dec 25",
    "Jan 26",
    "Feb 26",
    "Mar 26",
    "Apr 26",
    "May 26",
  ];
  return months.map((m, i) => {
    let v = base;
    const t = i / (months.length - 1);
    if (shape === "rising") v = base + step * i;
    if (shape === "falling") v = base - step * i;
    if (shape === "volatile")
      v = base + Math.sin(i * 1.2) * step * 2 + (Math.random() - 0.5) * step;
    if (shape === "flat") v = base + (Math.random() - 0.5) * step * 0.3;
    if (shape === "dip")
      v = base + step * i - (i === 5 ? step * 4 : 0) - (i === 6 ? step * 3 : 0);
    return { period: m, value: Number(v.toFixed(2)) };
  });
}

export const kpis: KPI[] = [
  {
    id: "revenue-growth",
    name: "Revenue Growth",
    domain: "Finance",
    value: 12.4,
    unit: "%",
    previousValue: 9.8,
    change: 2.6,
    trend: "up",
    goodWhen: "up",
    status: "Certified",
    owner: "Priya Raman — FP&A",
    sourceSystem: "Salesforce / Certinia",
    refreshFrequency: "Monthly",
    confidenceScore: 96,
    lastRefresh: "2026-05-14 06:12 UTC",
    definition:
      "Year-over-year percentage growth in recognised revenue across all booking entities. Net of credits and post-period adjustments.",
    formula: "(Current Period Revenue − Prior Period Revenue) / Prior Period Revenue × 100",
    relatedDashboards: ["Finance Exec Dashboard", "Board Pack — Revenue"],
    relatedKPIs: ["Forecast Accuracy", "Customer Retention"],
    limitations:
      "Excludes intercompany eliminations finalised after T+5. FX rates use month-end spot — translation differences may appear vs. budget.",
    history: makeHistory(8, "rising", 0.6),
    whyMoved:
      "Enterprise renewal cohort in EMEA closed early in the period, lifting recurring revenue by 3.1 pts. Offset by a 0.5 pt drop in Professional Services.",
  },
  {
    id: "attrition-rate",
    name: "Attrition Rate",
    domain: "HR",
    value: 11.2,
    unit: "%",
    previousValue: 13.6,
    change: -2.4,
    trend: "down",
    goodWhen: "down",
    status: "Certified",
    owner: "Marcus Lee — People Analytics",
    sourceSystem: "Workday",
    refreshFrequency: "Monthly",
    confidenceScore: 92,
    lastRefresh: "2026-05-13 02:45 UTC",
    definition:
      "Percentage of employees who left during the period compared to average headcount.",
    formula: "Leavers / Average Headcount × 100",
    relatedDashboards: ["People Dashboard", "Talent Risk Cockpit"],
    relatedKPIs: ["Workforce Cost", "Utilisation"],
    limitations:
      "Excludes internal transfers and contingent workers. Annualised number uses trailing-12-month leaver totals.",
    history: makeHistory(13, "falling", 0.25),
    whyMoved:
      "Q1 retention bonuses landed in March; voluntary exits in Engineering dropped 38%. Involuntary attrition rose slightly due to a Sales performance cycle.",
  },
  {
    id: "workforce-cost",
    name: "Workforce Cost",
    domain: "HR",
    value: 184_320_000,
    unit: "$",
    previousValue: 178_900_000,
    change: 5_420_000,
    trend: "up",
    goodWhen: "down",
    status: "Certified",
    owner: "Priya Raman — FP&A",
    sourceSystem: "SAP",
    refreshFrequency: "Monthly",
    confidenceScore: 94,
    lastRefresh: "2026-05-14 03:30 UTC",
    definition:
      "Total fully-loaded employee cost including salary, benefits, employer taxes, and equity expense.",
    formula: "Σ (Base Pay + Variable Comp + Benefits + Employer Taxes + Equity Expense)",
    relatedDashboards: ["Workforce P&L", "Finance Exec Dashboard"],
    relatedKPIs: ["Attrition Rate", "Utilisation"],
    limitations:
      "Equity expense uses Black-Scholes assumptions reset quarterly. Contingent labour reported separately in Procurement Spend.",
    history: makeHistory(178, "rising", 0.9).map((p) => ({
      period: p.period,
      value: p.value * 1_000_000,
    })),
    whyMoved:
      "Net new hires in Engineering and Customer Success added $3.8M. April merit cycle contributed $1.6M of structural lift.",
  },
  {
    id: "utilisation",
    name: "Utilisation",
    domain: "Operations",
    value: 78.6,
    unit: "%",
    previousValue: 74.2,
    change: 4.4,
    trend: "up",
    goodWhen: "up",
    status: "Draft",
    owner: "Ifeoma Adeyemi — Delivery Ops",
    sourceSystem: "Salesforce / Certinia",
    refreshFrequency: "Weekly",
    confidenceScore: 81,
    lastRefresh: "2026-05-15 08:00 UTC",
    definition:
      "Billable hours as a percentage of available hours across consulting and delivery teams.",
    formula: "Billable Hours / (Available Hours − Approved Time Off) × 100",
    relatedDashboards: ["Delivery Ops Cockpit", "Practice P&L"],
    relatedKPIs: ["Revenue Growth", "Workforce Cost"],
    limitations:
      "Draft — currently excludes apprentice cohort. Timesheets locked T+3, so the latest week is provisional.",
    history: makeHistory(72, "rising", 0.7),
    whyMoved:
      "Two large EMEA programmes started ramp in April, lifting billable hours by ~9,400. Bench size reduced from 41 to 28 consultants.",
  },
  {
    id: "procurement-spend",
    name: "Procurement Spend",
    domain: "Procurement",
    value: 62_400_000,
    unit: "$",
    previousValue: 58_900_000,
    change: 3_500_000,
    trend: "up",
    goodWhen: "down",
    status: "Certified",
    owner: "Raphael Costa — Procurement",
    sourceSystem: "Coupa",
    refreshFrequency: "Weekly",
    confidenceScore: 89,
    lastRefresh: "2026-05-14 22:10 UTC",
    definition:
      "Total committed spend across approved purchase orders and invoices, excluding payroll and intercompany.",
    formula: "Σ (PO Commitments + Non-PO Invoices) − Intercompany",
    relatedDashboards: ["Procurement Dashboard", "Supplier Risk Board"],
    relatedKPIs: ["Supplier Approval Cycle", "Workforce Cost"],
    limitations:
      "Marketing campaign commitments classified under indirect spend can lag by ~5 business days from contract signature.",
    history: makeHistory(58, "rising", 0.55).map((p) => ({
      period: p.period,
      value: p.value * 1_000_000,
    })),
    whyMoved:
      "Cloud infrastructure renewal pulled $2.1M forward into April; professional services committed for the data platform programme added $1.4M.",
  },
  {
    id: "supplier-approval-cycle",
    name: "Supplier Approval Cycle",
    domain: "Procurement",
    value: 7.8,
    unit: "days",
    previousValue: 11.2,
    change: -3.4,
    trend: "down",
    goodWhen: "down",
    status: "Certified",
    owner: "Raphael Costa — Procurement",
    sourceSystem: "Coupa",
    refreshFrequency: "Weekly",
    confidenceScore: 90,
    lastRefresh: "2026-05-14 22:10 UTC",
    definition:
      "Median number of business days between supplier onboarding request and final approval.",
    formula: "Median(Approval Date − Request Date) over completed onboardings",
    relatedDashboards: ["Procurement Dashboard"],
    relatedKPIs: ["Procurement Spend"],
    limitations:
      "Excludes suppliers escalated to Legal — those follow a separate workflow with its own SLA.",
    history: makeHistory(12, "falling", 0.35),
    whyMoved:
      "New parallel-approval workflow shipped in mid-March cut average wait time by 2.6 days. Risk-tier matrix removed redundant InfoSec review for low-risk vendors.",
  },
  {
    id: "customer-retention",
    name: "Customer Retention",
    domain: "Sales",
    value: 94.2,
    unit: "%",
    previousValue: 92.8,
    change: 1.4,
    trend: "up",
    goodWhen: "up",
    status: "Certified",
    owner: "Anaya Patel — Revenue Ops",
    sourceSystem: "Salesforce / Certinia",
    refreshFrequency: "Monthly",
    confidenceScore: 93,
    lastRefresh: "2026-05-14 04:00 UTC",
    definition:
      "Gross revenue retention from customers at the start of the period, before expansion.",
    formula: "(Starting ARR − Churned ARR − Downgrade ARR) / Starting ARR × 100",
    relatedDashboards: ["Revenue Ops Dashboard", "QBR Pack"],
    relatedKPIs: ["Revenue Growth", "SLA Compliance"],
    limitations:
      "Customers with active legal disputes are excluded from the cohort to avoid skewing the trend.",
    history: makeHistory(92, "rising", 0.18),
    whyMoved:
      "Top-100 account programme reduced churn by 0.9 pts. One mid-market account ($1.1M ARR) downgraded but did not churn.",
  },
  {
    id: "sla-compliance",
    name: "SLA Compliance",
    domain: "Operations",
    value: 96.4,
    unit: "%",
    previousValue: 97.9,
    change: -1.5,
    trend: "down",
    goodWhen: "up",
    status: "Needs Review",
    owner: "Hugo Bernard — Customer Ops",
    sourceSystem: "SQL Database",
    refreshFrequency: "Daily",
    confidenceScore: 72,
    lastRefresh: "2026-05-15 05:55 UTC",
    definition:
      "Percentage of customer tickets resolved within their contractual SLA window.",
    formula: "Tickets Resolved Within SLA / Total Tickets Closed × 100",
    relatedDashboards: ["Customer Ops Cockpit"],
    relatedKPIs: ["Customer Retention"],
    limitations:
      "Currently includes auto-closed tickets, which may inflate the number. Needs review by Customer Ops before Board reporting.",
    history: makeHistory(98, "dip", 0.3),
    whyMoved:
      "Two P1 incidents in mid-April breached SLA on 132 tickets. Backlog from EU region not fully cleared during May 1 holiday week.",
  },
  {
    id: "forecast-accuracy",
    name: "Forecast Accuracy",
    domain: "Finance",
    value: 91.7,
    unit: "%",
    previousValue: 88.4,
    change: 3.3,
    trend: "up",
    goodWhen: "up",
    status: "Certified",
    owner: "Priya Raman — FP&A",
    sourceSystem: "TM1 / IBM Planning Analytics",
    refreshFrequency: "Monthly",
    confidenceScore: 88,
    lastRefresh: "2026-05-14 06:35 UTC",
    definition:
      "Inverse mean absolute percentage error between revenue forecast (T-1 month) and actuals.",
    formula: "100 − Mean(|Forecast − Actual| / Actual × 100)",
    relatedDashboards: ["FP&A Dashboard", "Board Pack — Revenue"],
    relatedKPIs: ["Revenue Growth"],
    limitations:
      "Computed only on top-30 deals by ARR. Long-tail SMB segment is forecast in aggregate.",
    history: makeHistory(86, "rising", 0.55),
    whyMoved:
      "New ML-assisted late-stage scoring reduced over-forecasting on commit deals; April actuals landed within 2.1% of submitted forecast.",
  },
  {
    id: "data-quality-score",
    name: "Data Quality Score",
    domain: "Data",
    value: 84.5,
    unit: "score",
    previousValue: 81.2,
    change: 3.3,
    trend: "up",
    goodWhen: "up",
    status: "Draft",
    owner: "Sara Khalid — Data Governance",
    sourceSystem: "SQL Database",
    refreshFrequency: "Daily",
    confidenceScore: 78,
    lastRefresh: "2026-05-15 03:20 UTC",
    definition:
      "Composite score across completeness, freshness, accuracy, and conformity tests on certified data products.",
    formula: "Weighted average of test pass-rates: Completeness (0.3) + Freshness (0.3) + Accuracy (0.25) + Conformity (0.15)",
    relatedDashboards: ["Data Governance Dashboard"],
    relatedKPIs: ["Forecast Accuracy", "SLA Compliance"],
    limitations:
      "Draft — Conformity weight under review. New Procurement domain not yet onboarded into the test suite.",
    history: makeHistory(80, "rising", 0.5),
    whyMoved:
      "Two stale data products fixed (Finance recurring revenue cube, HR position data). Adding 14 new freshness checks reduced silent staleness in dashboards.",
  },
];

export function getKPI(id: string) {
  return kpis.find((k) => k.id === id);
}

export const domains: ("All" | "Finance" | "HR" | "Procurement" | "Operations" | "Sales" | "Data")[] = [
  "All",
  "Finance",
  "HR",
  "Procurement",
  "Operations",
  "Sales",
  "Data",
];

export const statuses: ("All" | "Certified" | "Draft" | "Needs Review")[] = [
  "All",
  "Certified",
  "Draft",
  "Needs Review",
];
