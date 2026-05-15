import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { explainKpiWithAnthropic } from "@/lib/ai/anthropic";
import { generateMockAIResponse } from "@/lib/mockAI";
import { getKPI as getSampleKpi } from "@/lib/data/kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kpiId: z.string().min(1),
  question: z.string().min(1).max(2000),
  workspaceSlug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  // ── Resolve KPI context ──────────────────────────────────────────────────
  // Prefers DB (authenticated, workspace-scoped) and falls back to sample data
  // for the unauthenticated demo. Sample data path is removed once the public
  // demo workspace is migrated to DB.
  let kpiContext: Parameters<typeof explainKpiWithAnthropic>[1] | null = null;
  let dbKpiId: string | null = null;
  let workspaceId: string | null = null;

  if (userId && body.workspaceSlug) {
    const membership = await prisma.membership.findFirst({
      where: { userId, workspace: { slug: body.workspaceSlug } },
      include: { workspace: true },
    });
    if (membership) {
      workspaceId = membership.workspaceId;
      const dbKpi = await prisma.kpi.findUnique({
        where: { workspaceId_slug: { workspaceId, slug: body.kpiId } },
      });
      if (dbKpi) {
        dbKpiId = dbKpi.id;
        kpiContext = {
          name: dbKpi.name,
          domain: dbKpi.domain,
          value: dbKpi.value,
          previousValue: dbKpi.previousValue,
          unit: dbKpi.unit,
          status: dbKpi.status,
          owner: dbKpi.owner,
          sourceSystem: dbKpi.sourceSystem,
          refreshFrequency: dbKpi.refreshFrequency,
          lastRefresh: dbKpi.lastRefresh?.toISOString(),
          confidenceScore: dbKpi.confidenceScore,
          definition: dbKpi.definition,
          formula: dbKpi.formula,
          limitations: dbKpi.limitations,
          whyMoved: dbKpi.whyMoved ?? undefined,
          relatedDashboards: dbKpi.relatedDashboards,
          relatedKPIs: dbKpi.relatedKpiSlugs,
        };
      }
    }
  }

  if (!kpiContext) {
    const sample = getSampleKpi(body.kpiId);
    if (!sample) {
      return NextResponse.json({ error: "KPI not found" }, { status: 404 });
    }
    kpiContext = {
      name: sample.name,
      domain: sample.domain,
      value: sample.value,
      previousValue: sample.previousValue,
      unit: sample.unit,
      status: sample.status,
      owner: sample.owner,
      sourceSystem: sample.sourceSystem,
      refreshFrequency: sample.refreshFrequency,
      lastRefresh: sample.lastRefresh,
      confidenceScore: sample.confidenceScore,
      definition: sample.definition,
      formula: sample.formula,
      limitations: sample.limitations,
      whyMoved: sample.whyMoved,
      relatedDashboards: sample.relatedDashboards,
      relatedKPIs: sample.relatedKPIs,
    };
  }

  // ── Provider selection ──────────────────────────────────────────────────
  const provider = process.env.OPENKPI_AI_PROVIDER ?? "mock";
  let response;
  try {
    if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      response = await explainKpiWithAnthropic(body.question, kpiContext);
    } else {
      // mock fallback — works without any key
      const sample = getSampleKpi(body.kpiId);
      const mock = generateMockAIResponse(body.question, sample);
      response = { ...mock, provider: "mock" as const, model: "mock", usage: { input: 0, output: 0 } };
    }
  } catch (e) {
    console.error("[/api/explain] LLM call failed", e);
    return NextResponse.json(
      { error: "LLM call failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  // ── Audit ───────────────────────────────────────────────────────────────
  if (workspaceId && userId) {
    await prisma.auditEvent
      .create({
        data: {
          workspaceId,
          userId,
          action: "ai.ask",
          targetType: "kpi",
          targetId: dbKpiId,
          metadata: {
            question: body.question,
            provider: response.provider,
            model: response.model,
            inputTokens: response.usage.input,
            outputTokens: response.usage.output,
            confidence: response.confidence,
          },
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    answer: response.answer,
    sources: response.sources,
    confidence: response.confidence,
    assumptions: response.assumptions,
    followUps: response.followUps,
    provider: response.provider,
    model: response.model,
  });
}
