import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gateEdit, gateView } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  // gateEdit, not gateView: even on PUBLIC workspaces, member emails are
  // sensitive — only people who can already edit should see the roster.
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: ws.id },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { workspaceId: ws.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({ members, invitations });
}

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(["VIEWER", "EDITOR", "STEWARD", "ADMIN"]).default("EDITOR"),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  if (!(gate as { canAdmin?: boolean }).canAdmin) {
    return NextResponse.json({ error: "Only ADMIN members can invite" }, { status: 403 });
  }
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let body: z.infer<typeof InviteBody>;
  try {
    body = InviteBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  // If they're already a user + member, short-circuit.
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
  });
  if (existingUser) {
    const m = await prisma.membership.findFirst({
      where: { userId: existingUser.id, workspaceId: ws.id },
    });
    if (m) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }
  }

  const token = randomBytes(24).toString("base64url");
  const inv = await prisma.invitation.create({
    data: {
      workspaceId: ws.id,
      email: body.email.toLowerCase(),
      role: body.role as Role,
      token,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? req.nextUrl.host;
  const link = `${proto}://${host}/invite/${token}`;

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "workspace.invite",
        targetType: "workspace",
        targetId: ws.id,
        metadata: { email: body.email, role: body.role },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ invitation: inv, link }, { status: 201 });
}
