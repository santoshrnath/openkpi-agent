import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  role: z.enum(["VIEWER", "EDITOR", "STEWARD", "ADMIN"]),
});

/**
 * PATCH /api/workspaces/[slug]/members/[userId] — change a member's role.
 * Admin-only. Refuses to demote the last ADMIN (would orphan the workspace).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; userId: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  if (!(gate as { canAdmin?: boolean }).canAdmin) {
    return NextResponse.json(
      { error: "Only ADMIN members can change roles." },
      { status: 403 }
    );
  }

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  const m = await prisma.membership.findFirst({
    where: { workspaceId: gate.workspaceId, userId: params.userId },
  });
  if (!m) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

  if (m.role === Role.ADMIN && body.role !== Role.ADMIN) {
    const remainingAdmins = await prisma.membership.count({
      where: { workspaceId: gate.workspaceId, role: Role.ADMIN, NOT: { id: m.id } },
    });
    if (remainingAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot demote the last ADMIN. Promote another member first." },
        { status: 409 }
      );
    }
  }

  await prisma.membership.update({
    where: { id: m.id },
    data: { role: body.role as Role },
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: gate.workspaceId,
        action: "workspace.member.update",
        targetType: "workspace",
        targetId: gate.workspaceId,
        metadata: { userId: params.userId, fromRole: m.role, toRole: body.role },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, role: body.role });
}

/**
 * DELETE /api/workspaces/[slug]/members/[userId] — revoke a membership.
 * Admin-only. Refuses to remove the last ADMIN.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; userId: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  if (!(gate as { canAdmin?: boolean }).canAdmin) {
    return NextResponse.json(
      { error: "Only ADMIN members can remove members." },
      { status: 403 }
    );
  }

  const m = await prisma.membership.findFirst({
    where: { workspaceId: gate.workspaceId, userId: params.userId },
  });
  if (!m) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

  if (m.role === Role.ADMIN) {
    const remainingAdmins = await prisma.membership.count({
      where: { workspaceId: gate.workspaceId, role: Role.ADMIN, NOT: { id: m.id } },
    });
    if (remainingAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot remove the last ADMIN. Promote another member first." },
        { status: 409 }
      );
    }
  }

  await prisma.membership.delete({ where: { id: m.id } });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: gate.workspaceId,
        action: "workspace.member.remove",
        targetType: "workspace",
        targetId: gate.workspaceId,
        metadata: { userId: params.userId, role: m.role },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
