import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/workspaces/[slug]/invitations/[id]
 *
 * Revokes a pending invitation. Admin-only. Does nothing if the invite is
 * already accepted — once accepted, the membership has to be removed
 * separately via DELETE /members/[userId].
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  if (!(gate as { canAdmin?: boolean }).canAdmin) {
    return NextResponse.json(
      { error: "Only ADMIN members can revoke invitations." },
      { status: 403 }
    );
  }

  const inv = await prisma.invitation.findFirst({
    where: { id: params.id, workspaceId: gate.workspaceId },
  });
  if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (inv.acceptedAt) {
    return NextResponse.json(
      { error: "Invitation already accepted — remove the membership instead via DELETE /members/[userId]." },
      { status: 409 }
    );
  }

  await prisma.invitation.delete({ where: { id: inv.id } });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: gate.workspaceId,
        action: "workspace.invite.revoke",
        targetType: "workspace",
        targetId: gate.workspaceId,
        metadata: { email: inv.email, role: inv.role },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, revoked: inv.email });
}
