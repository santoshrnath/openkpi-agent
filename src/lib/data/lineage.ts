import { LineageFlow } from "@/types";

export const lineageFlows: LineageFlow[] = [
  {
    kpiId: "procurement-spend",
    kpiName: "Procurement Spend",
    domain: "Procurement",
    steps: [
      {
        id: "src",
        label: "Coupa",
        detail: "Source of truth for POs, invoices and supplier master.",
        kind: "source",
      },
      {
        id: "stg",
        label: "SQL Staging",
        detail: "Nightly extract of POs, invoices, supplier records into raw schema.",
        kind: "staging",
      },
      {
        id: "xform",
        label: "Spend Transformation",
        detail: "Currency conversion, intercompany elimination, GL mapping.",
        kind: "transform",
      },
      {
        id: "semantic",
        label: "Procurement Semantic Model",
        detail: "Certified business definitions, hierarchies, calculated measures.",
        kind: "semantic",
      },
      {
        id: "dash",
        label: "Procurement Dashboard",
        detail: "Power BI workspace consumed by Finance leadership.",
        kind: "dashboard",
      },
      {
        id: "kpi",
        label: "Procurement Spend",
        detail: "Certified KPI reported in monthly board pack.",
        kind: "kpi",
      },
    ],
  },
  {
    kpiId: "attrition-rate",
    kpiName: "Attrition Rate",
    domain: "HR",
    steps: [
      {
        id: "src",
        label: "Workday",
        detail: "Authoritative HRIS for headcount, joiners, leavers, position data.",
        kind: "source",
      },
      {
        id: "stg",
        label: "SQL Staging",
        detail: "Daily snapshots of worker, job, and position objects.",
        kind: "staging",
      },
      {
        id: "xform",
        label: "Headcount Transformation",
        detail: "Calendarised headcount, leaver classification, dedupe of internal transfers.",
        kind: "transform",
      },
      {
        id: "semantic",
        label: "People Semantic Model",
        detail: "Certified business hierarchy: legal entity, region, function, level.",
        kind: "semantic",
      },
      {
        id: "dash",
        label: "People Dashboard",
        detail: "Talent Risk Cockpit + monthly People Review pack.",
        kind: "dashboard",
      },
      {
        id: "kpi",
        label: "Attrition Rate",
        detail: "Certified KPI reviewed monthly by CPO and CEO staff.",
        kind: "kpi",
      },
    ],
  },
  {
    kpiId: "revenue-growth",
    kpiName: "Revenue Growth",
    domain: "Finance",
    steps: [
      {
        id: "src",
        label: "Salesforce / Certinia",
        detail: "Bookings, contracts, billings and revenue recognition events.",
        kind: "source",
      },
      {
        id: "stg",
        label: "SQL Staging",
        detail: "CDC stream landed into raw, deduped, conformed.",
        kind: "staging",
      },
      {
        id: "xform",
        label: "Revenue Transformation",
        detail: "ASC 606 schedule materialisation, FX translation, eliminations.",
        kind: "transform",
      },
      {
        id: "semantic",
        label: "Finance Semantic Model",
        detail: "Single source of truth for GAAP & non-GAAP revenue measures.",
        kind: "semantic",
      },
      {
        id: "dash",
        label: "Finance Exec Dashboard",
        detail: "Board pack, CFO review, FP&A operating cadence.",
        kind: "dashboard",
      },
      {
        id: "kpi",
        label: "Revenue Growth",
        detail: "Certified board-grade KPI.",
        kind: "kpi",
      },
    ],
  },
];

export function getLineage(kpiId: string) {
  return lineageFlows.find((l) => l.kpiId === kpiId);
}
