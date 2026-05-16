import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/workspaces/[slug]/connections/[id]
 *
 * Removes a data-source connection. KPIs backed by it survive — the
 * Kpi.connectionId FK is `onDelete: SetNull`, so the KPIs simply stop
 * auto-refreshing and become editable as static.
 *
 * Admin-only to make the blast radius explicit (one click removes the live
 * refresh path for every KPI on this source).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  if (!(gate as { canAdmin?: boolean }).canAdmin) {
    return NextResponse.json(
      { error: "Only ADMIN members can delete a data-source connection." },
      { status: 403 }
    );
  }

  const conn = await prisma.sourceConnection.findFirst({
    where: { id: params.id, workspaceId: gate.workspaceId },
    include: { _count: { select: { kpis: true } } },
  });
  if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  await prisma.sourceConnection.delete({ where: { id: conn.id } });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: gate.workspaceId,
        action: "connection.delete",
        targetType: "source",
        targetId: conn.id,
        metadata: {
          kind: conn.kind,
          name: conn.name,
          kpisOrphaned: conn._count.kpis,
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, deleted: conn.id, kpisOrphaned: conn._count.kpis });
}
