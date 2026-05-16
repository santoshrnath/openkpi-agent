import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/acl";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const inv = await prisma.invitation.findUnique({
    where: { token: params.token },
    include: { workspace: true },
  });
  if (!inv) notFound();
  if (inv.acceptedAt) redirect(`/w/${inv.workspace.slug}`);
  if (inv.expiresAt < new Date()) {
    return (
      <div style={{ maxWidth: 460, margin: "80px auto", padding: 20 }}>
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Invite expired</h1>
          <p style={{ color: "rgb(var(--text-muted))", fontSize: 14 }}>
            Ask the workspace admin to send a fresh invite.
          </p>
        </div>
      </div>
    );
  }

  const viewer = await getViewer();
  if (!viewer.userId) {
    // Send them to login; they come back here after sign-in to accept.
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/invite/${params.token}`)}`);
  }

  // Match email of the invite to the signed-in user; if different, refuse.
  if (viewer.email && viewer.email.toLowerCase() !== inv.email.toLowerCase()) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 20 }}>
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Wrong account</h1>
          <p style={{ color: "rgb(var(--text-muted))", fontSize: 14, lineHeight: 1.6 }}>
            This invite was sent to <strong>{inv.email}</strong>, but you’re signed
            in as <strong>{viewer.email}</strong>. Sign out and sign in with the
            invited email, or ask the admin to re-send.
          </p>
        </div>
      </div>
    );
  }

  // Accept: create membership + mark invite accepted.
  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_workspaceId: { userId: viewer.userId, workspaceId: inv.workspaceId } },
      update: { role: inv.role },
      create: { userId: viewer.userId, workspaceId: inv.workspaceId, role: inv.role },
    }),
    prisma.invitation.update({
      where: { id: inv.id },
      data: { acceptedAt: new Date() },
    }),
    prisma.auditEvent.create({
      data: {
        workspaceId: inv.workspaceId,
        userId: viewer.userId,
        action: "workspace.member.accept",
        targetType: "workspace",
        targetId: inv.workspaceId,
        metadata: { email: inv.email, role: inv.role },
      },
    }),
  ]);

  redirect(`/w/${inv.workspace.slug}`);
}
