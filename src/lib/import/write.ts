import { prisma } from "@/lib/db";
import { ValidKpi } from "./validate";

export interface WriteSummary {
  created: number;
  updated: number;
  /** KPI names that were upserted (for the UI confirmation list). */
  names: string[];
}

/**
 * Upsert the validated KPI records into the workspace. Existing KPIs with
 * matching slugs are updated in place (so users can re-upload corrections
 * without dropping their lineage / AI history).
 */
export async function writeKpis(
  workspaceId: string,
  records: ValidKpi[]
): Promise<WriteSummary> {
  let created = 0;
  let updated = 0;
  const names: string[] = [];

  for (const r of records) {
    const existing = await prisma.kpi.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: r.slug } },
    });
    const data = {
      name: r.name,
      domain: r.domain,
      value: r.value,
      previousValue: r.previousValue,
      unit: r.unit,
      goodWhenUp: r.goodWhenUp,
      trend: r.trend,
      status: r.status,
      owner: r.owner,
      sourceSystem: r.sourceSystem,
      refreshFrequency: r.refreshFrequency,
      confidenceScore: r.confidenceScore,
      definition: r.definition,
      formula: r.formula,
      limitations: r.limitations,
      whyMoved: r.whyMoved,
      lastRefresh: new Date(),
    };
    if (existing) {
      await prisma.kpi.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.kpi.create({
        data: { workspaceId, slug: r.slug, ...data, relatedDashboards: [], relatedKpiSlugs: [] },
      });
      created += 1;
    }
    names.push(r.name);
  }

  return { created, updated, names };
}
