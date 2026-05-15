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
