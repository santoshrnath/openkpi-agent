/* eslint-disable no-console */
/**
 * Seed script — creates a "demo" workspace populated with the original sample
 * KPIs and lineage flows. Idempotent: safe to run multiple times.
 *
 *   npx prisma db seed
 */
import { PrismaClient, KpiStatus, KpiDomain, KpiTrend, KpiUnit, LineageKind } from "@prisma/client";
import { kpis as sampleKpis } from "../src/lib/data/kpis";
import { lineageFlows as sampleLineage } from "../src/lib/data/lineage";

const prisma = new PrismaClient();

const DOMAIN_MAP: Record<string, KpiDomain> = {
  Finance: KpiDomain.FINANCE,
  HR: KpiDomain.HR,
  Procurement: KpiDomain.PROCUREMENT,
  Operations: KpiDomain.OPERATIONS,
  Sales: KpiDomain.SALES,
  Data: KpiDomain.DATA,
};

const UNIT_MAP: Record<string, KpiUnit> = {
  "%": KpiUnit.PERCENT,
  $: KpiUnit.CURRENCY,
  days: KpiUnit.DAYS,
  score: KpiUnit.SCORE,
  ratio: KpiUnit.RATIO,
  count: KpiUnit.COUNT,
};

const STATUS_MAP: Record<string, KpiStatus> = {
  Certified: KpiStatus.CERTIFIED,
  Draft: KpiStatus.DRAFT,
  "Needs Review": KpiStatus.NEEDS_REVIEW,
};

const TREND_MAP: Record<string, KpiTrend> = {
  up: KpiTrend.UP,
  down: KpiTrend.DOWN,
  flat: KpiTrend.FLAT,
};

const LINEAGE_KIND: Record<string, LineageKind> = {
  source: LineageKind.SOURCE,
  staging: LineageKind.STAGING,
  transform: LineageKind.TRANSFORM,
  semantic: LineageKind.SEMANTIC,
  dashboard: LineageKind.DASHBOARD,
  kpi: LineageKind.KPI,
};

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

  for (const k of sampleKpis) {
    const kpi = await prisma.kpi.upsert({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: k.id } },
      update: {
        name: k.name,
        domain: DOMAIN_MAP[k.domain] ?? KpiDomain.CUSTOM,
        value: k.value,
        previousValue: k.previousValue,
        unit: UNIT_MAP[k.unit] ?? KpiUnit.RATIO,
        goodWhenUp: k.goodWhen === "up",
        trend: TREND_MAP[k.trend],
        status: STATUS_MAP[k.status] ?? KpiStatus.DRAFT,
        owner: k.owner,
        sourceSystem: k.sourceSystem,
        refreshFrequency: k.refreshFrequency,
        lastRefresh: new Date(),
        confidenceScore: k.confidenceScore,
        definition: k.definition,
        formula: k.formula,
        limitations: k.limitations,
        whyMoved: k.whyMoved,
        relatedDashboards: k.relatedDashboards,
        relatedKpiSlugs: k.relatedKPIs,
      },
      create: {
        workspaceId: ws.id,
        slug: k.id,
        name: k.name,
        domain: DOMAIN_MAP[k.domain] ?? KpiDomain.CUSTOM,
        value: k.value,
        previousValue: k.previousValue,
        unit: UNIT_MAP[k.unit] ?? KpiUnit.RATIO,
        goodWhenUp: k.goodWhen === "up",
        trend: TREND_MAP[k.trend],
        status: STATUS_MAP[k.status] ?? KpiStatus.DRAFT,
        owner: k.owner,
        sourceSystem: k.sourceSystem,
        refreshFrequency: k.refreshFrequency,
        lastRefresh: new Date(),
        confidenceScore: k.confidenceScore,
        definition: k.definition,
        formula: k.formula,
        limitations: k.limitations,
        whyMoved: k.whyMoved,
        relatedDashboards: k.relatedDashboards,
        relatedKpiSlugs: k.relatedKPIs,
      },
    });

    // history
    await prisma.kpiHistoryPoint.deleteMany({ where: { kpiId: kpi.id } });
    await prisma.kpiHistoryPoint.createMany({
      data: k.history.map((p) => ({
        kpiId: kpi.id,
        period: p.period,
        value: p.value,
      })),
    });
  }

  // lineage
  for (const flow of sampleLineage) {
    const kpi = await prisma.kpi.findUnique({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: flow.kpiId } },
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
        flowId: lf.id,
        ordinal: i,
        label: s.label,
        detail: s.detail,
        kind: LINEAGE_KIND[s.kind],
        status: "Active",
      })),
    });
  }

  console.log(`✓ Seeded ${sampleKpis.length} KPIs and ${sampleLineage.length} lineage flows into workspace '${ws.slug}'.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
