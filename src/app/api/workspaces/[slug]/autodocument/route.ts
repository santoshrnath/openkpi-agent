import { NextRequest, NextResponse } from "next/server";
import { KpiDomain } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";
import { suggestKpiDocs } from "@/lib/ai/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Bulk-fill missing documentation across every KPI in the workspace that has
 * at least one blank core field (definition, formula, or limitations).
 *
 * Returns:
 *   { filled: number, skipped: number, errors: [{slug, message}] }
 *
 * Hard-capped at 25 KPIs per call to keep latency bounded; large catalogues
 * can be filled by calling repeatedly.
 */
export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // Pick KPIs that need documentation. A KPI is "undocumented" if any of
  // (definition, formula, limitations) is empty.
  const candidates = await prisma.kpi.findMany({
    where: {
      workspaceId: ws.id,
      OR: [
        { definition: "" },
        { formula: "" },
        { limitations: "" },
      ],
    },
    take: 25,
  });

  let filled = 0;
  let skipped = 0;
  const errors: { slug: string; message: string }[] = [];

  for (const kpi of candidates) {
    try {
      const s = await suggestKpiDocs({
        name: kpi.name,
        value: kpi.value,
        previousValue: kpi.previousValue,
        unit: kpi.unit,
        workspaceName: ws.name,
        existing: {
          definition: kpi.definition || undefined,
          formula: kpi.formula || undefined,
          limitations: kpi.limitations || undefined,
        },
      });

      const data: Record<string, unknown> = {};
      if (!kpi.definition.trim()) data.definition = s.definition;
      if (!kpi.formula.trim()) data.formula = s.formula;
      if (!kpi.limitations.trim()) data.limitations = s.limitations;
      if (kpi.domain === KpiDomain.CUSTOM) data.domain = s.domain;
      if (kpi.owner === "Unassigned" || !kpi.owner.trim()) data.owner = s.ownerHint;
      if (kpi.sourceSystem === "Unknown" || !kpi.sourceSystem.trim())
        data.sourceSystem = s.sourceSystemHint;

      if (Object.keys(data).length > 0) {
        await prisma.kpi.update({ where: { id: kpi.id }, data });
        filled += 1;
      } else {
        skipped += 1;
      }
    } catch (e) {
      errors.push({ slug: kpi.slug, message: e instanceof Error ? e.message : String(e) });
    }
  }

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "workspace.autodocument",
        targetType: "workspace",
        targetId: ws.id,
        metadata: { filled, skipped, errors: errors.length, scanned: candidates.length },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    scanned: candidates.length,
    filled,
    skipped,
    errors,
  });
}
