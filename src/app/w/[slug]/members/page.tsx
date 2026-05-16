import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { prisma } from "@/lib/db";
import { getWorkspaceAccess } from "@/lib/acl";
import { MembersClient } from "./MembersClient";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: { slug: string } }) {
  const access = await getWorkspaceAccess(params.slug);
  if (!access) notFound();

  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) notFound();

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

  const base = `/w/${params.slug}`;
  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>Members</span>
      </div>

      <Hero
        kicker="Workspace · Members"
        title={<>Who can see <span className="gradient-text">{ws.name}</span></>}
        subtitle={
          access.canAdmin
            ? "Invite teammates by email. Admins can invite and change roles; Editors can edit KPIs; Viewers are read-only."
            : "Only admins can invite or remove. You can see the current member list below."
        }
      />

      <MembersClient
        workspaceSlug={params.slug}
        canAdmin={access.canAdmin}
        members={members.map((m) => ({
          id: m.id,
          role: m.role,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
        }))}
        invitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </>
  );
}
