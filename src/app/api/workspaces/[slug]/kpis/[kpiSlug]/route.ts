import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  refreshFrequency: z
    .enum([
      "Real-time",
      "Every 5 minutes",
      "Every 15 minutes",
      "Every hour",
      "Daily",
      "Weekly",
      "Monthly",
      "Quarterly",
      "Manual",
    ])
    .optional(),
  status: z.enum(["DRAFT", "CERTIFIED", "NEEDS_REVIEW"]).optional(),
  name: z.string().min(2).max(120).optional(),
  owner: z.string().max(120).optional(),
  definition: z.string().max(4000).optional(),
  limitations: z.string().max(4000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; kpiSlug: string } }
) {
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const kpi = await prisma.kpi.findUnique({
    where: { workspaceId_slug: { workspaceId: ws.id, slug: params.kpiSlug } },
  });
  if (!kpi) return NextResponse.json({ error: "KPI not found" }, { status: 404 });

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  const updated = await prisma.kpi.update({
    where: { id: kpi.id },
    data: body,
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "kpi.update",
        targetType: "kpi",
        targetId: kpi.id,
        metadata: { changes: body },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ slug: updated.slug, ok: true });
}
