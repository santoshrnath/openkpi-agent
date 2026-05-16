import "server-only";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Role, Visibility } from "@prisma/client";
import { prisma } from "./db";

export interface Viewer {
  /** Local User row id (cuid). null if not signed in. */
  userId: string | null;
  /** Clerk user_xxx id, if signed in. */
  clerkId: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
}

const ANON: Viewer = {
  userId: null,
  clerkId: null,
  email: null,
  name: null,
  image: null,
};

/**
 * Resolve the current request's viewer.
 *
 * Flow:
 *   1. Clerk's auth() gives us clerkId (or null if signed out)
 *   2. Look up the local User row by clerkId
 *   3. First-time sign-in: try matching by email (to inherit any pre-Clerk
 *      Memberships / KPIs / audit FKs) — link if found, else create fresh.
 *
 * The local User row's id stays stable across provider swaps, so every
 * existing foreign key keeps working.
 */
export async function getViewer(): Promise<Viewer> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return ANON;

  let user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user) {
    const client = await clerkClient();
    const c = await client.users.getUser(clerkId);
    const email = c.primaryEmailAddress?.emailAddress
      ?? c.emailAddresses[0]?.emailAddress
      ?? null;
    const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ") || null;
    const image = c.imageUrl ?? null;

    // First-time provisioning is race-prone: Next.js fires the layout and
    // page in parallel, so two requests both see "no user with this clerkId"
    // and both try to create. Strategy:
    //   1. Atomically claim any legacy row with this email and no clerkId
    //   2. If something was claimed, re-read by clerkId
    //   3. Otherwise create; if create races and hits P2002, re-read.
    if (email) {
      const linked = await prisma.user.updateMany({
        where: { email, clerkId: null },
        data: {
          clerkId,
          name: fullName ?? undefined,
          image: image ?? undefined,
        },
      });
      if (linked.count > 0) {
        user = await prisma.user.findUnique({ where: { clerkId } });
      }
    }

    if (!user) {
      try {
        user = await prisma.user.create({
          data: { clerkId, email, name: fullName, image },
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") {
          user = await prisma.user.findUnique({ where: { clerkId } });
        }
        if (!user) throw e;
      }
    }
  }

  return {
    userId: user.id,
    clerkId,
    email: user.email,
    name: user.name,
    image: user.image,
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

export async function gateView(slug: string): Promise<NextResponse | WorkspaceAccess> {
  const a = await getWorkspaceAccess(slug);
  if (!a) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (!a.canView) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return a;
}

export async function gateEdit(slug: string): Promise<NextResponse | WorkspaceAccess> {
  const a = await getWorkspaceAccess(slug);
  if (!a) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const v = await getViewer();
  if (!v.userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!a.canEdit) return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  return a;
}

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
