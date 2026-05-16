import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Clones every KPI + lineage flow from the public 'demo' workspace into the
 * target workspace. Idempotent at the KPI-slug level (upsert), so re-running
 * doesn't duplicate. Each cloned KPI gets a fresh `lastRefresh = now()` so
 * the scheduled refresh treats it as recently-touched.
 *
 * Used by the onboarding wizard ("Use sample data" tile) so users can play
 * with a realistic catalogue in seconds.
 */
export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;

  // Source = demo workspace (must be PUBLIC and pre-seeded).
  const source = await prisma.workspace.findUnique({
    where: { slug: "demo" },
    include: {
      kpis: { include: { history: true } },
      lineageFlows: { include: { steps: true } },
    },
  });
  if (!source) {
    return NextResponse.json(
      { error: "Sample workspace 'demo' not found on this server." },
      { status: 500 }
    );
  }

  const target = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!target) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (target.id === source.id) {
    return NextResponse.json(
      { error: "Cannot clone the demo workspace onto itself." },
      { status: 409 }
    );
  }

  let createdKpis = 0;
  let updatedKpis = 0;
  let createdFlows = 0;

  const slugMap = new Map<string, string>(); // source kpiId → target kpiId

  for (const k of source.kpis) {
    const existing = await prisma.kpi.findUnique({
      where: { workspaceId_slug: { workspaceId: target.id, slug: k.slug } },
    });
    const baseData = {
      name: k.name,
      domain: k.domain,
      value: k.value,
      previousValue: k.previousValue,
      unit: k.unit,
      goodWhenUp: k.goodWhenUp,
      trend: k.trend,
      status: k.status,
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
      relatedKpiSlugs: k.relatedKpiSlugs,
    };

    let kpi;
    if (existing) {
      kpi = await prisma.kpi.update({
        where: { id: existing.id },
        data: baseData,
      });
      updatedKpis += 1;
    } else {
      kpi = await prisma.kpi.create({
        data: { workspaceId: target.id, slug: k.slug, ...baseData },
      });
      createdKpis += 1;
    }

    slugMap.set(k.id, kpi.id);

    // History: wipe and recreate so we have a clean copy.
    await prisma.kpiHistoryPoint.deleteMany({ where: { kpiId: kpi.id } });
    if (k.history.length > 0) {
      await prisma.kpiHistoryPoint.createMany({
        data: k.history.map((h) => ({
          kpiId: kpi.id,
          period: h.period,
          value: h.value,
        })),
      });
    }
  }

  // Lineage flows: only clone flows whose source KPI exists in the target.
  for (const flow of source.lineageFlows) {
    const targetKpiId = slugMap.get(flow.kpiId);
    if (!targetKpiId) continue;
    const existing = await prisma.lineageFlow.findUnique({ where: { kpiId: targetKpiId } });
    if (existing) {
      await prisma.lineageStep.deleteMany({ where: { flowId: existing.id } });
      await prisma.lineageStep.createMany({
        data: flow.steps.map((s) => ({
          flowId: existing.id,
          ordinal: s.ordinal,
          label: s.label,
          detail: s.detail,
          kind: s.kind,
          owner: s.owner,
          refresh: s.refresh,
          status: s.status,
        })),
      });
    } else {
      const newFlow = await prisma.lineageFlow.create({
        data: { workspaceId: target.id, kpiId: targetKpiId },
      });
      await prisma.lineageStep.createMany({
        data: flow.steps.map((s) => ({
          flowId: newFlow.id,
          ordinal: s.ordinal,
          label: s.label,
          detail: s.detail,
          kind: s.kind,
          owner: s.owner,
          refresh: s.refresh,
          status: s.status,
        })),
      });
      createdFlows += 1;
    }
  }

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: target.id,
        action: "workspace.seed-sample",
        targetType: "workspace",
        targetId: target.id,
        metadata: { createdKpis, updatedKpis, createdFlows, source: "demo" },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    ok: true,
    createdKpis,
    updatedKpis,
    createdFlows,
  });
}
