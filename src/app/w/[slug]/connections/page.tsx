import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Database, Plus } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { prisma } from "@/lib/db";
import { getWorkspaceBySlug } from "@/lib/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  params,
}: {
  params: { slug: string };
}) {
  const ws = await getWorkspaceBySlug(params.slug);
  if (!ws) notFound();

  const connections = await prisma.sourceConnection.findMany({
    where: { workspaceId: ws.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { kpis: true } } },
  });

  const base = `/w/${params.slug}`;
  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>Data Sources</span>
      </div>

      <Hero
        kicker="Data Sources"
        title={<>Live connections to your <span className="gradient-text">warehouse</span>.</>}
        subtitle="Attach a Postgres / Redshift / Aurora database and build KPIs from queries. Refreshes update values in place and log every change to the audit trail."
        actions={
          <Link href={`${base}/connections/new`} className="btn btn-primary">
            <Plus size={14} /> New connection
          </Link>
        }
      />

      {connections.length === 0 ? (
        <div className={`card ${styles.empty}`}>
          <h2>No data sources yet</h2>
          <p>
            Connect a Postgres database (Redshift / Aurora / vanilla PG all work)
            to build KPIs from live queries.
          </p>
          <div style={{ marginTop: 16 }}>
            <Link href={`${base}/connections/new`} className="btn btn-primary">
              <Plus size={14} /> Add your first connection
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {connections.map((c) => (
            <Link
              key={c.id}
              href={`${base}/connections/${c.id}`}
              className={`card ${styles.connCard}`}
            >
              <div className={styles.connHead}>
                <div>
                  <div className={styles.connKind}>{c.kind}</div>
                  <div className={styles.connName}>
                    <Database size={14} style={{ display: "inline", marginRight: 8 }} />
                    {c.name}
                  </div>
                </div>
                <span>
                  <span className={c.status === "CONNECTED" ? styles.dot : `${styles.dot} ${styles.dotErr}`} />
                  {c.status.toLowerCase()}
                </span>
              </div>
              <div className={styles.connSub}>
                {c._count.kpis} KPI{c._count.kpis === 1 ? "" : "s"} backed by this source
                {c.lastSyncAt && ` · last sync ${new Date(c.lastSyncAt).toLocaleString()}`}
              </div>
              {c.lastError && (
                <div className={styles.connSub} style={{ color: "rgb(190,18,60)" }}>
                  Last error: {c.lastError}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
