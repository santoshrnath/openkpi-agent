import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the workspaces the signed-in viewer is a member of, with their
 * role. Used by the WorkspaceSwitcher in the sidebar.
 *
 * Anonymous viewers get an empty list (200 OK) — the switcher then renders
 * just the "Create workspace" CTA.
 */
export async function GET(_req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.userId) return NextResponse.json({ workspaces: [] });

  const memberships = await prisma.membership.findMany({
    where: { userId: viewer.userId },
    include: {
      workspace: {
        select: { id: true, slug: true, name: true, visibility: true, tagline: true },
      },
    },
    orderBy: { workspace: { name: "asc" } },
  });

  return NextResponse.json({
    workspaces: memberships.map((m) => ({
      slug: m.workspace.slug,
      name: m.workspace.name,
      visibility: m.workspace.visibility,
      tagline: m.workspace.tagline,
      role: m.role,
    })),
  });
}
