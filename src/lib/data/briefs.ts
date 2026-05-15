import { ExecutiveBrief } from "@/types";

export function buildExecutiveBrief(): ExecutiveBrief {
  return {
    generatedAt: new Date().toISOString(),
    period: "April → May 2026",
    headline:
      "Revenue and retention are accelerating, but SLA Compliance and Data Quality need governance attention before the next board cycle.",
    keyMovements: [
      {
        kpi: "Revenue Growth",
        direction: "up",
        insight:
          "Revenue growth rose to 12.4% (+2.6 pts), led by early EMEA enterprise renewals.",
      },
      {
        kpi: "Attrition Rate",
        direction: "down",
        insight:
          "Attrition fell to 11.2% (-2.4 pts) after Q1 retention programme; voluntary exits in Engineering down 38%.",
      },
      {
        kpi: "Utilisation",
        direction: "up",
        insight:
          "Utilisation climbed to 78.6%, reflecting ramp on two large EMEA programmes and bench reduction.",
      },
      {
        kpi: "SLA Compliance",
        direction: "down",
        insight:
          "SLA dropped 1.5 pts to 96.4% following two P1 incidents in mid-April. Currently flagged 'Needs Review'.",
      },
    ],
    risks: [
      "SLA Compliance breach pattern concentrated in EU region; risk of executive escalation if not stabilised by end of May.",
      "Workforce Cost growth ($+5.4M MoM) is structural — April merit cycle effect is now baked into run rate.",
      "Procurement Spend lift is driven by cloud renewal; ensure cost commit is reflected in next forecast cycle.",
    ],
    opportunities: [
      "Forecast Accuracy improved 3.3 pts — the ML-assisted scoring rollout has clear ROI; expand to mid-market deals.",
      "Customer Retention 94.2% supports a price-uplift conversation on top-100 accounts at QBR.",
      "Supplier Approval Cycle now 7.8 days — communicate to business as enablement win.",
    ],
    suggestedActions: [
      "Convene a 24h review with Customer Ops on SLA Compliance methodology before board cut-off.",
      "Promote Data Quality Score from Draft → Certified once Procurement domain is onboarded.",
      "Re-baseline Workforce Cost forecast to absorb the April merit cycle structurally.",
    ],
    needsReview: ["SLA Compliance", "Data Quality Score", "Utilisation"],
    dataQualityNotes: [
      "SLA Compliance currently includes auto-closed tickets — pending fix lowers confidence to 72%.",
      "Utilisation latest week is provisional (timesheets lock T+3).",
      "Data Quality Score weight matrix under review by Data Governance.",
    ],
  };
}
