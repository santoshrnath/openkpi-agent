import {
  KpiDomain,
  KpiStatus,
  KpiTrend,
  KpiUnit,
} from "@prisma/client";
import { ParsedRow } from "./parse";

/** A row that's been parsed AND coerced to typed fields. */
export interface ValidKpi {
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
  whyMoved: string | null;
}

export interface RowError {
  rowIndex: number;
  field?: string;
  message: string;
}

export interface ValidationResult {
  records: ValidKpi[];
  errors: RowError[];
}

// ─── coercion helpers ────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "kpi";
}

function parseNumber(raw: string | undefined, fallback: number | null = null): number | null {
  if (raw == null || raw === "") return fallback;
  // strip $, %, commas, spaces, currency symbols
  const cleaned = String(raw).replace(/[\s$£€₹,]/g, "").replace(/%$/, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw === "") return fallback;
  const v = raw.toString().trim().toLowerCase();
  if (["true", "yes", "y", "1", "up", "higher", "good", "positive"].includes(v)) return true;
  if (["false", "no", "n", "0", "down", "lower", "bad", "negative"].includes(v)) return false;
  return fallback;
}

const DOMAIN_MAP: Record<string, KpiDomain> = {
  finance: KpiDomain.FINANCE,
  hr: KpiDomain.HR,
  "human resources": KpiDomain.HR,
  people: KpiDomain.HR,
  procurement: KpiDomain.PROCUREMENT,
  spend: KpiDomain.PROCUREMENT,
  operations: KpiDomain.OPERATIONS,
  ops: KpiDomain.OPERATIONS,
  sales: KpiDomain.SALES,
  revenue: KpiDomain.SALES,
  data: KpiDomain.DATA,
  it: KpiDomain.DATA,
  custom: KpiDomain.CUSTOM,
};

function parseDomain(raw: string | undefined): KpiDomain {
  const v = (raw ?? "").trim().toLowerCase();
  return DOMAIN_MAP[v] ?? KpiDomain.CUSTOM;
}

const STATUS_MAP: Record<string, KpiStatus> = {
  certified: KpiStatus.CERTIFIED,
  approved: KpiStatus.CERTIFIED,
  draft: KpiStatus.DRAFT,
  wip: KpiStatus.DRAFT,
  "in progress": KpiStatus.DRAFT,
  "needs review": KpiStatus.NEEDS_REVIEW,
  review: KpiStatus.NEEDS_REVIEW,
  "needs-review": KpiStatus.NEEDS_REVIEW,
};

function parseStatus(raw: string | undefined): KpiStatus {
  const v = (raw ?? "").trim().toLowerCase();
  return STATUS_MAP[v] ?? KpiStatus.DRAFT;
}

const UNIT_MAP: Record<string, KpiUnit> = {
  "%": KpiUnit.PERCENT,
  percent: KpiUnit.PERCENT,
  pct: KpiUnit.PERCENT,
  "$": KpiUnit.CURRENCY,
  currency: KpiUnit.CURRENCY,
  usd: KpiUnit.CURRENCY,
  money: KpiUnit.CURRENCY,
  days: KpiUnit.DAYS,
  day: KpiUnit.DAYS,
  d: KpiUnit.DAYS,
  score: KpiUnit.SCORE,
  ratio: KpiUnit.RATIO,
  count: KpiUnit.COUNT,
  number: KpiUnit.COUNT,
  num: KpiUnit.COUNT,
  "": KpiUnit.COUNT,
};

function parseUnit(raw: string | undefined): KpiUnit {
  const v = (raw ?? "").trim().toLowerCase();
  return UNIT_MAP[v] ?? KpiUnit.COUNT;
}

function trendFor(value: number, previous: number): KpiTrend {
  if (value > previous) return KpiTrend.UP;
  if (value < previous) return KpiTrend.DOWN;
  return KpiTrend.FLAT;
}

// ─── per-row validation ─────────────────────────────────────────────────────
export function validateRow(row: ParsedRow): { record?: ValidKpi; errors: RowError[] } {
  const f = row.fields;
  const errors: RowError[] = [];

  const name = (f.name ?? "").trim();
  if (!name) {
    errors.push({ rowIndex: row.rowIndex, field: "name", message: "Required" });
  }

  const value = parseNumber(f.value);
  if (value === null) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "value",
      message: `Required and must be a number (got "${f.value ?? ""}")`,
    });
  }

  if (errors.length > 0) return { errors };

  const previousValue = parseNumber(f.previous_value, value!) ?? value!;
  const unit = parseUnit(f.unit);
  const goodWhenUp = parseBool(f.good_when_up, true);
  const status = parseStatus(f.status);
  const domain = parseDomain(f.domain);
  const confidenceScore = Math.max(0, Math.min(100,
    Math.round(parseNumber(f.confidence_score, 70) ?? 70)
  ));

  const record: ValidKpi = {
    slug: slugify(name),
    name,
    domain,
    value: value!,
    previousValue,
    unit,
    goodWhenUp,
    trend: trendFor(value!, previousValue),
    status,
    owner: (f.owner ?? "").trim() || "Unassigned",
    sourceSystem: (f.source_system ?? "").trim() || "Unknown",
    refreshFrequency: (f.refresh_frequency ?? "").trim() || "Monthly",
    confidenceScore,
    definition: (f.definition ?? "").trim(),
    formula: (f.formula ?? "").trim(),
    limitations: (f.limitations ?? "").trim(),
    whyMoved: (f.why_moved ?? "").trim() || null,
  };

  return { record, errors: [] };
}

export function validateRows(rows: ParsedRow[]): ValidationResult {
  const records: ValidKpi[] = [];
  const errors: RowError[] = [];
  const seenSlugs = new Set<string>();

  for (const row of rows) {
    const { record, errors: rowErrors } = validateRow(row);
    errors.push(...rowErrors);
    if (record) {
      // de-duplicate by slug within the same upload — append index if collision
      let slug = record.slug;
      let dupCount = 1;
      while (seenSlugs.has(slug)) {
        dupCount += 1;
        slug = `${record.slug}-${dupCount}`;
      }
      seenSlugs.add(slug);
      records.push({ ...record, slug });
    }
  }

  return { records, errors };
}
