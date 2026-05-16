import { NextRequest, NextResponse } from "next/server";
import { KpiTrend } from "@prisma/client";
import { prisma } from "@/lib/db";
import { makeConnector } from "@/lib/connectors";
import { gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string; kpiSlug: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const kpi = await prisma.kpi.findUnique({
    where: { workspaceId_slug: { workspaceId: ws.id, slug: params.kpiSlug } },
    include: { connection: true },
  });
  if (!kpi) return NextResponse.json({ error: "KPI not found" }, { status: 404 });
  if (!kpi.connection) {
    return NextResponse.json(
      { error: "This KPI was not created from a connector. Refresh only works on connector-backed KPIs." },
      { status: 400 }
    );
  }

  let value: number;
  try {
    const c = makeConnector(kpi.connection);
    const result = await c.query(kpi.formula, { rowLimit: 1 });
    if (!result.rows.length) {
      return NextResponse.json({ error: "Query returned no rows" }, { status: 422 });
    }
    const firstRow = result.rows[0];
    const firstKey = Object.keys(firstRow)[0];
    const raw = firstRow[firstKey];
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (!Number.isFinite(n)) {
      return NextResponse.json(
        { error: `Query's first column is not numeric (got "${String(raw)}")` },
        { status: 422 }
      );
    }
    value = n;
  } catch (e) {
    return NextResponse.json(
      { error: "Refresh failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  const previousValue = kpi.value;
  const trend = value > previousValue ? KpiTrend.UP : value < previousValue ? KpiTrend.DOWN : KpiTrend.FLAT;

  const updated = await prisma.kpi.update({
    where: { id: kpi.id },
    data: {
      value,
      previousValue,
      trend,
      lastRefresh: new Date(),
      whyMoved:
        trend === KpiTrend.FLAT
          ? `Value unchanged at ${value} on the latest refresh.`
          : `Value moved from ${previousValue} to ${value} (${trend === KpiTrend.UP ? "+" : ""}${(value - previousValue).toFixed(2)}) on refresh.`,
    },
  });

  await prisma.kpiHistoryPoint.create({
    data: {
      kpiId: kpi.id,
      period: new Date().toISOString().slice(0, 10),
      value,
      at: new Date(),
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "kpi.refresh",
        targetType: "kpi",
        targetId: kpi.id,
        metadata: { connectionId: kpi.connection.id, previousValue, value, trend },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    slug: updated.slug,
    previousValue,
    value,
    trend,
    lastRefresh: updated.lastRefresh,
  });
}
