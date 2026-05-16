import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeConnector } from "@/lib/connectors";
import { KpiStatus, KpiDomain, KpiTrend, KpiUnit } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UNITS = ["PERCENT", "CURRENCY", "DAYS", "SCORE", "RATIO", "COUNT"] as const;
const DOMAINS = [
  "FINANCE", "HR", "PROCUREMENT", "OPERATIONS", "SALES", "DATA", "CUSTOM",
] as const;

const Body = z.object({
  name: z.string().min(2).max(120),
  domain: z.enum(DOMAINS).default("FINANCE"),
  unit: z.enum(UNITS).default("COUNT"),
  goodWhenUp: z.boolean().default(true),
  status: z.enum(["DRAFT", "CERTIFIED", "NEEDS_REVIEW"]).default("DRAFT"),
  owner: z.string().default("Unassigned"),
  definition: z.string().default(""),
  limitations: z.string().default(""),
  refreshFrequency: z.string().default("Daily"),
  /**
   * The SQL must return a SINGLE row with a SINGLE numeric column. The column
   * value becomes the KPI's current value. The query is stored in the KPI's
   * `formula` field for re-execution by /refresh.
   */
  sql: z.string().min(1).max(20_000),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "kpi";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const conn = await prisma.sourceConnection.findFirst({
    where: { id: params.id, workspaceId: ws.id },
  });
  if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  // Run the query to validate shape AND grab the initial value.
  let value: number;
  try {
    const c = makeConnector(conn);
    const result = await c.query(body.sql, { rowLimit: 1 });
    if (!result.rows.length) {
      return NextResponse.json({ error: "Query returned no rows" }, { status: 400 });
    }
    const firstRow = result.rows[0];
    const firstKey = Object.keys(firstRow)[0];
    const raw = firstRow[firstKey];
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (!Number.isFinite(n)) {
      return NextResponse.json(
        {
          error: `Query's first column is not numeric (got "${String(raw)}"). The first column must be the KPI value.`,
        },
        { status: 400 }
      );
    }
    value = n;
  } catch (e) {
    return NextResponse.json(
      { error: "Query failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  // Slug — make unique within workspace
  let slug = slugify(body.name);
  let n = 1;
  while (await prisma.kpi.findUnique({
    where: { workspaceId_slug: { workspaceId: ws.id, slug } },
  })) {
    n += 1;
    slug = `${slugify(body.name)}-${n}`;
  }

  const kpi = await prisma.kpi.create({
    data: {
      workspaceId: ws.id,
      slug,
      name: body.name,
      domain: body.domain as KpiDomain,
      value,
      previousValue: value,
      unit: body.unit as KpiUnit,
      goodWhenUp: body.goodWhenUp,
      trend: KpiTrend.FLAT,
      status: body.status as KpiStatus,
      owner: body.owner,
      sourceSystem: conn.name,
      refreshFrequency: body.refreshFrequency,
      confidenceScore: 85,
      definition: body.definition,
      formula: body.sql, // re-executed on /refresh
      limitations: body.limitations,
      whyMoved: "First import from connector — no movement yet.",
      lastRefresh: new Date(),
      relatedDashboards: [],
      relatedKpiSlugs: [],
      connectionId: conn.id,
    },
  });

  await prisma.kpiHistoryPoint.create({
    data: { kpiId: kpi.id, period: new Date().toISOString().slice(0, 7), value, at: new Date() },
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "kpi.create.from-connector",
        targetType: "kpi",
        targetId: kpi.id,
        metadata: { name: kpi.name, slug, connectionId: conn.id, initialValue: value },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ kpi: { slug, id: kpi.id, value } }, { status: 201 });
}
