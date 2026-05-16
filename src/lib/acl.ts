import "server-only";
import { getServerSession } from "next-auth";
import { Role, Visibility } from "@prisma/client";
import { authOptions } from "./auth";
import { prisma } from "./db";

export interface Viewer {
  userId: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
}

export async function getViewer(): Promise<Viewer> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id ?? null;
  return {
    userId,
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
  };
}

export interface WorkspaceAccess {
  workspaceId: string;
  slug: string;
  visibility: Visibility;
  /** null when the viewer is anonymous or not a member. */
  role: Role | null;
  /** true for PUBLIC workspaces or any member. */
  canView: boolean;
  /** true for EDITOR / STEWARD / ADMIN members. */
  canEdit: boolean;
  /** true only for ADMIN members. */
  canAdmin: boolean;
}

/** Resolve the viewer's access to a workspace. Returns null if workspace doesn't exist. */
export async function getWorkspaceAccess(
  slug: string,
  viewer?: Viewer
): Promise<WorkspaceAccess | null> {
  const v = viewer ?? (await getViewer());
  const ws = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, slug: true, visibility: true },
  });
  if (!ws) return null;

  let role: Role | null = null;
  if (v.userId) {
    const m = await prisma.membership.findFirst({
      where: { userId: v.userId, workspaceId: ws.id },
      select: { role: true },
    });
    role = m?.role ?? null;
  }

  const isMember = role != null;
  const canView = ws.visibility === Visibility.PUBLIC || isMember;
  const canEdit = isMember && role !== Role.VIEWER;
  const canAdmin = role === Role.ADMIN;

  return {
    workspaceId: ws.id,
    slug: ws.slug,
    visibility: ws.visibility,
    role,
    canView,
    canEdit,
    canAdmin,
  };
}

import { NextResponse } from "next/server";

/** Return an early NextResponse if the viewer cannot view this workspace. */
export async function gateView(slug: string): Promise<NextResponse | WorkspaceAccess> {
  const a = await getWorkspaceAccess(slug);
  if (!a) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (!a.canView) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return a;
}

/** Return an early NextResponse if the viewer cannot mutate this workspace. */
export async function gateEdit(slug: string): Promise<NextResponse | WorkspaceAccess> {
  const a = await getWorkspaceAccess(slug);
  if (!a) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const v = await getViewer();
  if (!v.userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!a.canEdit) return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  return a;
}

/** Convenience: throws 'unauthorized' / 'forbidden' if access is insufficient. */
export async function assertCanEdit(slug: string): Promise<WorkspaceAccess> {
  const a = await getWorkspaceAccess(slug);
  if (!a) {
    const err = new Error("workspace-not-found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  const viewer = await getViewer();
  if (!viewer.userId) {
    const err = new Error("unauthenticated");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!a.canEdit) {
    const err = new Error("forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return a;
}
