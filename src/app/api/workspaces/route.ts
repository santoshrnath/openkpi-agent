import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role, Visibility } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, and hyphens only"),
  tagline: z.string().max(200).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AED"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

const RESERVED = new Set(["new", "demo", "settings", "about", "api"]);

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  if (RESERVED.has(body.slug)) {
    return NextResponse.json(
      { error: "That slug is reserved. Pick another." },
      { status: 409 }
    );
  }

  const existing = await prisma.workspace.findUnique({ where: { slug: body.slug } });
  if (existing) {
    return NextResponse.json(
      { error: "Slug already in use. Pick another." },
      { status: 409 }
    );
  }

  const viewer = await getViewer();

  const ws = await prisma.workspace.create({
    data: {
      slug: body.slug,
      name: body.name,
      tagline: body.tagline,
      currency: body.currency ?? "USD",
      visibility: (body.visibility ?? "PRIVATE") as Visibility,
      // If we know the creator, make them admin so they own this workspace.
      memberships: viewer.userId
        ? { create: { userId: viewer.userId, role: Role.ADMIN } }
        : undefined,
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "workspace.create",
        targetType: "workspace",
        targetId: ws.id,
        metadata: { name: ws.name, slug: ws.slug },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ workspace: ws }, { status: 201 });
}
