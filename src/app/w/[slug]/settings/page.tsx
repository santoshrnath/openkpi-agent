import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { prisma } from "@/lib/db";
import { getWorkspaceAccess } from "@/lib/acl";
import { SettingsClient } from "./SettingsClient";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({ params }: { params: { slug: string } }) {
  const access = await getWorkspaceAccess(params.slug);
  if (!access) notFound();

  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) notFound();

  const base = `/w/${params.slug}`;
  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>Workspace settings</span>
      </div>

      <Hero
        kicker="Settings"
        title={<>Configure <span className="gradient-text">{ws.name}</span></>}
        subtitle={
          access.canAdmin
            ? "Rebrand, change visibility, manage members, or delete the workspace. Editor and Steward roles can update the name and tagline; only Admins can change visibility or delete."
            : "Read-only — only Admin members can change workspace settings."
        }
      />

      <SettingsClient
        slug={params.slug}
        workspace={{
          name: ws.name,
          tagline: ws.tagline,
          currency: ws.currency,
          visibility: ws.visibility,
          createdAt: ws.createdAt.toISOString(),
        }}
        canEdit={access.canEdit}
        canAdmin={access.canAdmin}
      />
    </>
  );
}
