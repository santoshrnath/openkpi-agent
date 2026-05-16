import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { getWorkspaceBySlug, listAuditEvents } from "@/lib/queries";
import { formatAuditEvent } from "@/lib/auditFormat";
import { relativeTime } from "@/lib/schedule";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const TONE_CLS: Record<string, string> = {
  info: styles.toneInfo,
  good: styles.toneGood,
  warn: styles.toneWarn,
  danger: styles.toneDanger,
};

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { action?: string; q?: string; cursor?: string };
}) {
  const ws = await getWorkspaceBySlug(params.slug);
  if (!ws) notFound();

  const result = await listAuditEvents({
    workspaceSlug: params.slug,
    action: searchParams?.action,
    q: searchParams?.q,
    cursor: searchParams?.cursor,
    take: 50,
  });
  if (!result) notFound();

  const base = `/w/${params.slug}`;
  const auditBase = `${base}/audit`;
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (overrides.action !== undefined && overrides.action !== "") params.set("action", overrides.action);
    else if (overrides.action === undefined && searchParams?.action) params.set("action", searchParams.action);
    if (overrides.q !== undefined && overrides.q !== "") params.set("q", overrides.q);
    else if (overrides.q === undefined && searchParams?.q) params.set("q", searchParams.q);
    if (overrides.cursor) params.set("cursor", overrides.cursor);
    const s = params.toString();
    return s ? `${auditBase}?${s}` : auditBase;
  };

  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>Audit log</span>
      </div>

      <Hero
        kicker="Workspace · Audit"
        title="Every action, recorded."
        subtitle="Read-only stream of who did what, when. Filter by action type or search by KPI / connection / user."
      />

      <div className={styles.filterBar}>
        <div className={styles.filterChips}>
          <Link
            href={buildHref({ action: "" })}
            className={cx("chip", !searchParams?.action && "chip-active")}
          >
            All
          </Link>
          {result.actions.map((a) => (
            <Link
              key={a.action}
              href={buildHref({ action: a.action })}
              className={cx("chip", searchParams?.action === a.action && "chip-active")}
            >
              {a.action} <span style={{ marginLeft: 4, opacity: 0.7 }}>{a.count}</span>
            </Link>
          ))}
        </div>
        <form style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="search"
            name="q"
            placeholder="Search action / target id…"
            defaultValue={searchParams?.q ?? ""}
            className="input"
            style={{ width: 240 }}
          />
          {searchParams?.action && (
            <input type="hidden" name="action" value={searchParams.action} />
          )}
          <button type="submit" className="btn btn-ghost btn-sm" title="Search">
            <Search size={14} />
          </button>
        </form>
      </div>

      <div className={`card ${styles.table}`}>
        {result.items.length === 0 ? (
          <div className={styles.empty}>
            No audit events match this filter. Try clearing search or selecting{" "}
            <Link href={auditBase} className="text-accent">All</Link>.
          </div>
        ) : (
          result.items.map((row) => {
            const fmt = formatAuditEvent(row.action, row.metadata as Record<string, unknown> | null);
            const Icon = fmt.icon;
            const userInitial = (row.user?.name ?? row.user?.email ?? "?").slice(0, 1).toUpperCase();
            return (
              <div key={row.id} className={styles.row}>
                <div className={cx(styles.iconCell, TONE_CLS[fmt.tone])}>
                  <Icon size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.title}>{fmt.title}</div>
                  <div className={styles.detail}>{fmt.detail}</div>
                </div>
                <div className={styles.who}>
                  {row.user ? (
                    <>
                      <span className={styles.avatar}>{userInitial}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.user.name ?? row.user.email}
                      </span>
                    </>
                  ) : (
                    <span className={styles.system}>system</span>
                  )}
                </div>
                <div className={styles.when} title={row.createdAt.toISOString()}>
                  {relativeTime(row.createdAt)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {result.nextCursor && (
        <div className={styles.pagination}>
          <Link
            href={buildHref({ cursor: result.nextCursor })}
            className="btn btn-ghost"
          >
            Load older events →
          </Link>
        </div>
      )}
    </>
  );
}
