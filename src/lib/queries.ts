import "server-only";
import { prisma } from "./db";

export async function listWorkspaces() {
  return prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { kpis: true } } },
  });
}

export async function getWorkspaceBySlug(slug: string) {
  return prisma.workspace.findUnique({ where: { slug } });
}

export async function getKpisForWorkspace(slug: string) {
  const ws = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      kpis: {
        orderBy: [{ confidenceScore: "desc" }],
        include: {
          history: { orderBy: { id: "asc" } },
        },
      },
    },
  });
  return ws;
}

export async function getKpiBySlug(workspaceSlug: string, kpiSlug: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  });
  if (!workspace) return null;
  return prisma.kpi.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: kpiSlug } },
    include: {
      history: { orderBy: { id: "asc" } },
      lineageFlow: { include: { steps: { orderBy: { ordinal: "asc" } } } },
      workspace: true,
    },
  });
}

export async function getLineageFlowsForWorkspace(slug: string) {
  const workspace = await prisma.workspace.findUnique({ where: { slug } });
  if (!workspace) return [];
  return prisma.lineageFlow.findMany({
    where: { workspaceId: workspace.id },
    include: {
      kpi: { select: { slug: true, name: true, domain: true, status: true } },
      steps: { orderBy: { ordinal: "asc" } },
    },
  });
}

export interface AuditQuery {
  workspaceSlug: string;
  /** Filter by action exact match (e.g. "kpi.refresh"). Omit for all. */
  action?: string;
  /** Substring search over action / targetId. */
  q?: string;
  cursor?: string; // event id to start after
  take?: number;   // default 50
}

export async function listAuditEvents(opts: AuditQuery) {
  const ws = await prisma.workspace.findUnique({ where: { slug: opts.workspaceSlug } });
  if (!ws) return null;

  const where: Record<string, unknown> = { workspaceId: ws.id };
  if (opts.action) where.action = opts.action;
  if (opts.q) {
    where.OR = [
      { action: { contains: opts.q, mode: "insensitive" } },
      { targetId: { contains: opts.q, mode: "insensitive" } },
    ];
  }

  const take = Math.min(opts.take ?? 50, 200);
  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    cursor: opts.cursor ? { id: opts.cursor } : undefined,
    skip: opts.cursor ? 1 : 0,
    include: { user: { select: { name: true, email: true, image: true } } },
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Distinct list of action types in this workspace for the filter chips.
  const actionsGroup = await prisma.auditEvent.groupBy({
    by: ["action"],
    where: { workspaceId: ws.id },
    _count: true,
    orderBy: { _count: { action: "desc" } },
    take: 24,
  });
  const actions = actionsGroup.map((g) => ({ action: g.action, count: g._count }));

  return { items, nextCursor, actions };
}

/**
 * Pull everything the Workspace Health page needs in a small fixed set of
 * queries. Keeps render time bounded even on large catalogues.
 */
export async function getWorkspaceHealth(slug: string) {
  const ws = await prisma.workspace.findUnique({ where: { slug } });
  if (!ws) return null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [kpis, recentFailures, recentRefreshes24h] = await Promise.all([
    prisma.kpi.findMany({
      where: { workspaceId: ws.id },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        domain: true,
        refreshFrequency: true,
        lastRefresh: true,
        confidenceScore: true,
        owner: true,
        sourceSystem: true,
        definition: true,
        formula: true,
        limitations: true,
        connectionId: true,
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId: ws.id,
        action: "kpi.refresh.auto.failed",
        createdAt: { gt: since24h },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.auditEvent.count({
      where: {
        workspaceId: ws.id,
        action: "kpi.refresh.auto",
        createdAt: { gt: since24h },
      },
    }),
  ]);

  return { workspace: ws, kpis, recentFailures, recentRefreshes24h };
}

export async function getWorkspaceSummary(slug: string) {
  const ws = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      _count: { select: { kpis: true } },
      kpis: { select: { status: true, confidenceScore: true } },
    },
  });
  if (!ws) return null;
  const total = ws.kpis.length;
  const certified = ws.kpis.filter((k) => k.status === "CERTIFIED").length;
  const review = ws.kpis.filter((k) => k.status === "NEEDS_REVIEW").length;
  const avgConf =
    total === 0 ? 0 : Math.round(ws.kpis.reduce((s, k) => s + k.confidenceScore, 0) / total);
  return { workspace: ws, total, certified, review, avgConf };
}
