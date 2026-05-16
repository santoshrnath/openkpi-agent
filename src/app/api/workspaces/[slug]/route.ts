import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Visibility } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  name: z.string().min(2).max(80).optional(),
  tagline: z.string().max(200).nullable().optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AED"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;

  // Visibility / delete require ADMIN; the other writes need any editor.
  const access = gate as { canAdmin?: boolean };

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  if (body.visibility != null && !access.canAdmin) {
    return NextResponse.json(
      { error: "Only ADMIN members can change visibility" },
      { status: 403 }
    );
  }

  const updated = await prisma.workspace.update({
    where: { slug: params.slug },
    data: {
      name: body.name,
      tagline: body.tagline,
      currency: body.currency,
      visibility: body.visibility as Visibility | undefined,
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: updated.id,
        action: "workspace.update",
        targetType: "workspace",
        targetId: updated.id,
        metadata: { changes: body },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ workspace: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  if (!(gate as { canAdmin?: boolean }).canAdmin) {
    return NextResponse.json(
      { error: "Only ADMIN members can delete the workspace" },
      { status: 403 }
    );
  }
  // demo workspace is the public marketing surface — guard against accidental loss.
  if (params.slug === "demo") {
    return NextResponse.json(
      { error: "The 'demo' workspace cannot be deleted via the API." },
      { status: 409 }
    );
  }

  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  await prisma.workspace.delete({ where: { id: ws.id } });
  // Audit event survives because workspaceId is just an id; the ws is gone.
  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "workspace.delete",
        targetType: "workspace",
        targetId: ws.id,
        metadata: { slug: ws.slug, name: ws.name },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, deleted: ws.slug });
}
