import { NextRequest, NextResponse } from "next/server";
import { KpiTrend } from "@prisma/client";
import { prisma } from "@/lib/db";
import { makeConnector } from "@/lib/connectors";
import { cadenceMs, isDue, nextRefreshAt } from "@/lib/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Refreshes all connector-backed KPIs whose next-due time has passed.
// Trigger from a host cron (every 5 min):
//   curl -s -H "Authorization: Bearer $CRON_SECRET" \
//        https://openstudio.oneplaceplatform.com/api/cron/refresh-due
// Auth: requires Bearer $CRON_SECRET. Without it, returns 401.
// Soft limit: 200 KPIs per call. Cron interval >= slowest cadence supported.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server not configured: CRON_SECRET missing" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const ok =
    auth === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get("token") === secret;
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Transient DB blips through the Coolify-NAT path occasionally drop a
  // connection. Retry once after a short backoff before giving up.
  async function findCandidates() {
    return prisma.kpi.findMany({
      where: { connectionId: { not: null } },
      include: { connection: true },
      take: 200,
    });
  }
  let candidates;
  try {
    candidates = await findCandidates();
  } catch (e) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      candidates = await findCandidates();
    } catch (e2) {
      return NextResponse.json(
        {
          error: "DB unreachable on retry; will tick again next interval",
          detail: e2 instanceof Error ? e2.message : String(e2),
        },
        { status: 503 }
      );
    }
  }

  const now = new Date();
  const due = candidates.filter((k) => isDue(k.lastRefresh, k.refreshFrequency, now));

  const results: {
    workspaceId: string;
    kpiSlug: string;
    ok: boolean;
    from?: number;
    to?: number;
    error?: string;
  }[] = [];

  for (const kpi of due) {
    if (!kpi.connection) continue;
    try {
      const c = makeConnector(kpi.connection);
      const rs = await c.query(kpi.formula, { rowLimit: 1 });
      if (!rs.rows.length) throw new Error("Query returned no rows");
      const firstKey = Object.keys(rs.rows[0])[0];
      const raw = rs.rows[0][firstKey];
      const n = typeof raw === "number" ? raw : Number(String(raw));
      if (!Number.isFinite(n)) throw new Error(`Non-numeric first column: ${String(raw)}`);

      const previousValue = kpi.value;
      const trend =
        n > previousValue ? KpiTrend.UP : n < previousValue ? KpiTrend.DOWN : KpiTrend.FLAT;

      await prisma.kpi.update({
        where: { id: kpi.id },
        data: {
          value: n,
          previousValue,
          trend,
          lastRefresh: new Date(),
          whyMoved:
            trend === KpiTrend.FLAT
              ? `Auto-refresh: unchanged at ${n}.`
              : `Auto-refresh: ${previousValue} → ${n} (${trend === KpiTrend.UP ? "+" : ""}${(n - previousValue).toFixed(2)}).`,
        },
      });

      await prisma.kpiHistoryPoint.create({
        data: {
          kpiId: kpi.id,
          period: new Date().toISOString().slice(0, 10),
          value: n,
          at: new Date(),
        },
      });

      await prisma.auditEvent
        .create({
          data: {
            workspaceId: kpi.workspaceId,
            action: "kpi.refresh.auto",
            targetType: "kpi",
            targetId: kpi.id,
            metadata: {
              connectionId: kpi.connectionId,
              previousValue,
              value: n,
              trend,
              cadence: kpi.refreshFrequency,
            },
          },
        })
        .catch(() => undefined);

      results.push({ workspaceId: kpi.workspaceId, kpiSlug: kpi.slug, ok: true, from: previousValue, to: n });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.auditEvent
        .create({
          data: {
            workspaceId: kpi.workspaceId,
            action: "kpi.refresh.auto.failed",
            targetType: "kpi",
            targetId: kpi.id,
            metadata: { error: message, cadence: kpi.refreshFrequency },
          },
        })
        .catch(() => undefined);
      results.push({ workspaceId: kpi.workspaceId, kpiSlug: kpi.slug, ok: false, error: message });
    }
  }

  return NextResponse.json({
    now: now.toISOString(),
    scanned: candidates.length,
    due: due.length,
    refreshed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    nextTicks: candidates.slice(0, 20).map((k) => ({
      slug: k.slug,
      cadence: k.refreshFrequency,
      cadenceMs: cadenceMs(k.refreshFrequency),
      lastRefresh: k.lastRefresh,
      nextDueAt: nextRefreshAt(k.lastRefresh, k.refreshFrequency),
    })),
  });
}
