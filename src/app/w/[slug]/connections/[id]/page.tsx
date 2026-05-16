import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Database } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { prisma } from "@/lib/db";
import { getWorkspaceBySlug } from "@/lib/queries";
import { getWorkspaceAccess } from "@/lib/acl";
import { ConnectionDetailClient } from "./ConnectionDetailClient";

export const dynamic = "force-dynamic";

export default async function ConnectionDetail({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const ws = await getWorkspaceBySlug(params.slug);
  if (!ws) notFound();
  const conn = await prisma.sourceConnection.findFirst({
    where: { id: params.id, workspaceId: ws.id },
    include: { _count: { select: { kpis: true } } },
  });
  if (!conn) notFound();

  const base = `/w/${params.slug}`;
  const ver = (conn.config as { version?: string } | null)?.version ?? null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12, color: "rgb(var(--text-soft))" }}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <Link href={`${base}/connections`}>Data Sources</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>{conn.name}</span>
      </div>

      <Hero
        kicker={`${conn.kind} · ${conn.status.toLowerCase()}`}
        title={<><Database size={20} style={{ display: "inline", marginRight: 8, color: "rgb(var(--accent))" }} />{conn.name}</>}
        subtitle={
          ver
            ? `Connected · ${ver.slice(0, 80)}${ver.length > 80 ? "…" : ""}`
            : "Build a KPI by pasting a SQL query that returns one row with one numeric column."
        }
      />

      <ConnectionDetailClient
        workspaceSlug={params.slug}
        connectionId={conn.id}
        connectionName={conn.name}
        connectionKind={conn.kind}
        kpiCount={conn._count.kpis}
        canAdmin={(await getWorkspaceAccess(params.slug))?.canAdmin ?? false}
      />
    </>
  );
}
