export type Domain =
  | "Finance"
  | "HR"
  | "Procurement"
  | "Operations"
  | "Sales"
  | "Data";

export type KPIStatus = "Certified" | "Draft" | "Needs Review";

export type KPITrend = "up" | "down" | "flat";

export type SourceSystem =
  | "Salesforce / Certinia"
  | "SAP"
  | "Sage X3"
  | "Board"
  | "TM1 / IBM Planning Analytics"
  | "Coupa"
  | "Workday"
  | "SQL Database"
  | "Excel";

export interface KPIHistoryPoint {
  period: string;
  value: number;
}

export interface KPI {
  id: string;
  name: string;
  domain: Domain;
  value: number;
  unit: "%" | "$" | "days" | "score" | "ratio" | "count";
  previousValue: number;
  change: number;
  trend: KPITrend;
  /**
   * Whether an `up` trend is good. Some KPIs (Attrition, Cycle time) invert.
   */
  goodWhen: "up" | "down";
  status: KPIStatus;
  owner: string;
  sourceSystem: SourceSystem;
  refreshFrequency: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Real-time";
  confidenceScore: number; // 0..100
  lastRefresh: string;
  definition: string;
  formula: string;
  relatedDashboards: string[];
  relatedKPIs: string[];
  limitations: string;
  history: KPIHistoryPoint[];
  whyMoved: string;
}

export interface LineageStep {
  id: string;
  label: string;
  detail: string;
  kind:
    | "source"
    | "staging"
    | "transform"
    | "semantic"
    | "dashboard"
    | "kpi";
}

export interface LineageFlow {
  kpiId: string;
  kpiName: string;
  domain: Domain;
  steps: LineageStep[];
}

export interface AIMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  sources?: string[];
  confidence?: number;
  assumptions?: string[];
  followUps?: string[];
  createdAt: number;
}

export interface AIResponse {
  answer: string;
  sources: string[];
  confidence: number;
  assumptions: string[];
  followUps: string[];
}

export interface ExecutiveBrief {
  generatedAt: string;
  period: string;
  headline: string;
  keyMovements: { kpi: string; insight: string; direction: KPITrend }[];
  risks: string[];
  opportunities: string[];
  suggestedActions: string[];
  needsReview: string[];
  dataQualityNotes: string[];
}
