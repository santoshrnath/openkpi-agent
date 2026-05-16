import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, AlertTriangle, CheckCircle2, FileEdit, Clock, ShieldCheck } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { getWorkspaceHealth } from "@/lib/queries";
import { cadenceMs, relativeTime, nextRefreshAt } from "@/lib/schedule";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function humaniseDuration(ms: number): string {
  if (ms < 60_000) return `${Math.max(0, Math.round(ms / 1000))}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))} h`;
  return `${Math.round(ms / (24 * 60 * 60_000))} d`;
}

export default async function HealthPage({ params }: { params: { slug: string } }) {
  const data = await getWorkspaceHealth(params.slug);
  if (!data) notFound();
  const { workspace, kpis, recentFailures, recentRefreshes24h } = data;
  const now = Date.now();
  const base = `/w/${params.slug}`;

  // ── Stale: connector-backed KPIs whose next-due time has passed ────────
  const stale = kpis
    .filter((k) => k.connectionId != null)
    .map((k) => {
      const cadence = cadenceMs(k.refreshFrequency);
      if (cadence == null || !k.lastRefresh) return null;
      const overdueBy = now - k.lastRefresh.getTime() - cadence;
      if (overdueBy <= 0) return null;
      return { kpi: k, overdueBy, expectedAt: nextRefreshAt(k.lastRefresh, k.refreshFrequency) };
    })
    .filter((x): x is { kpi: typeof kpis[number]; overdueBy: number; expectedAt: Date | null } => x !== null)
    .sort((a, b) => b.overdueBy - a.overdueBy)
    .slice(0, 25);

  // ── Documentation / stewardship gaps ───────────────────────────────────
  const total = kpis.length;
  const missingDef = kpis.filter((k) => !k.definition.trim()).length;
  const missingFormula = kpis.filter((k) => !k.formula.trim()).length;
  const missingLim = kpis.filter((k) => !k.limitations.trim()).length;
  const unassigned = kpis.filter((k) => !k.owner || k.owner === "Unassigned" || !k.owner.trim()).length;
  const noSource = kpis.filter((k) => !k.sourceSystem || k.sourceSystem === "Unknown" || !k.sourceSystem.trim()).length;
  const pct = (n: number) => (total === 0 ? "" : `${Math.round((n / total) * 100)}%`);

  // ── Certification mix donut ────────────────────────────────────────────
  const certified = kpis.filter((k) => k.status === "CERTIFIED").length;
  const draft = kpis.filter((k) => k.status === "DRAFT").length;
  const review = kpis.filter((k) => k.status === "NEEDS_REVIEW").length;
  const avgConf = total === 0 ? 0 : Math.round(kpis.reduce((s, k) => s + k.confidenceScore, 0) / total);

  // Donut arcs (SVG)
  const radius = 60;
  const cx_ = 80;
  const cy_ = 80;
  const circ = 2 * Math.PI * radius;
  let acc = 0;
  const arcs = [
    { value: certified, color: "rgb(5,150,105)", label: "Certified" },
    { value: draft, color: "rgb(180,83,9)", label: "Draft" },
    { value: review, color: "rgb(190,18,60)", label: "Needs review" },
  ].map((seg) => {
    const start = acc;
    const len = total === 0 ? 0 : (seg.value / total) * circ;
    acc += len;
    return { ...seg, start, len };
  });

  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>Workspace health</span>
      </div>

      <Hero
        kicker="Operations"
        title={<>How healthy is <span className="gradient-text">{workspace.name}</span>?</>}
        subtitle={`Stale data, refresh failures, documentation gaps and certification mix. Refreshed on every page load.`}
      />

      {/* ── Headline tiles ─────────────────────────────────────────────── */}
      <div className={styles.summary}>
        <div className={`card ${styles.cell}`}>
          <div className={styles.label}>Total KPIs</div>
          <div className={styles.value}>{total}</div>
          <div className={styles.delta}>{kpis.filter((k) => k.connectionId).length} connector-backed</div>
        </div>
        <div className={`card ${styles.cell}`}>
          <div className={styles.label}>Stale right now</div>
          <div className={cx(styles.value, stale.length > 0 ? styles["tone-warn"] : styles["tone-good"])}>
            {stale.length}
          </div>
          <div className={styles.delta}>
            {stale.length === 0
              ? "All connector-backed KPIs within cadence"
              : "Past their auto-refresh window"}
          </div>
        </div>
        <div className={`card ${styles.cell}`}>
          <div className={styles.label}>Failures (24h)</div>
          <div className={cx(styles.value, recentFailures.length > 0 ? styles["tone-danger"] : styles["tone-good"])}>
            {recentFailures.length}
          </div>
          <div className={styles.delta}>
            {recentRefreshes24h} successful auto-refresh{recentRefreshes24h === 1 ? "" : "es"} in the same window
          </div>
        </div>
        <div className={`card ${styles.cell}`}>
          <div className={styles.label}>Avg. confidence</div>
          <div
            className={cx(
              styles.value,
              avgConf >= 90 ? styles["tone-good"] :
              avgConf >= 75 ? styles["tone-warn"] :
              styles["tone-danger"]
            )}
          >
            {total === 0 ? "—" : `${avgConf}%`}
          </div>
          <div className={styles.delta}>
            {avgConf >= 90 ? "Healthy data foundation" : avgConf >= 75 ? "Some governance gaps" : "Needs attention"}
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── Stale list + recent failures ──────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>
                <Clock size={14} style={{ display: "inline", marginRight: 8, color: "rgb(var(--accent))" }} />
                Stale KPIs
              </div>
              <span className={styles.sectionCount}>{stale.length} overdue</span>
            </div>
            {stale.length === 0 ? (
              <div className={styles.empty}>
                <CheckCircle2 size={24} style={{ color: "rgb(5,150,105)", marginBottom: 8 }} />
                <div>Every connector-backed KPI is within its refresh window.</div>
              </div>
            ) : (
              <table className={styles.staleTable}>
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Cadence</th>
                    <th>Last refresh</th>
                    <th>Overdue by</th>
                  </tr>
                </thead>
                <tbody>
                  {stale.map(({ kpi, overdueBy }) => (
                    <tr key={kpi.id}>
                      <td>
                        <Link href={`${base}/catalog/${kpi.slug}`}>{kpi.name}</Link>
                      </td>
                      <td><span className={styles.cadence}>{kpi.refreshFrequency}</span></td>
                      <td style={{ color: "rgb(var(--text-muted))" }}>
                        {kpi.lastRefresh ? relativeTime(kpi.lastRefresh) : "never"}
                      </td>
                      <td className={styles.overdue}>{humaniseDuration(overdueBy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>
                <AlertTriangle size={14} style={{ display: "inline", marginRight: 8, color: "rgb(190,18,60)" }} />
                Refresh failures · 24h
              </div>
              <span className={styles.sectionCount}>{recentFailures.length} event{recentFailures.length === 1 ? "" : "s"}</span>
            </div>
            {recentFailures.length === 0 ? (
              <div className={styles.empty}>
                <CheckCircle2 size={24} style={{ color: "rgb(5,150,105)", marginBottom: 8 }} />
                <div>No auto-refresh failures in the last 24 hours.</div>
              </div>
            ) : (
              <div className={styles.failuresList}>
                {recentFailures.map((f) => {
                  const meta = (f.metadata as Record<string, unknown> | null) ?? {};
                  return (
                    <div key={f.id} className={styles.failureRow}>
                      <strong>kpi:{f.targetId ?? "—"}</strong>
                      <div>{(meta.error as string) ?? "Refresh failed."}</div>
                      <div className="when">
                        {relativeTime(f.createdAt)} · cadence {(meta.cadence as string) ?? "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right rail: cert mix + governance gaps ────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>
                <ShieldCheck size={14} style={{ display: "inline", marginRight: 8, color: "rgb(var(--accent))" }} />
                Certification mix
              </div>
            </div>
            <div className={styles.donut}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle
                  cx={cx_} cy={cy_} r={radius}
                  fill="none"
                  stroke="rgb(var(--surface-3))"
                  strokeWidth={18}
                />
                {arcs.map((a) => (
                  <circle
                    key={a.label}
                    cx={cx_} cy={cy_} r={radius}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={18}
                    strokeDasharray={`${a.len} ${circ - a.len}`}
                    strokeDashoffset={-a.start}
                    transform={`rotate(-90 ${cx_} ${cy_})`}
                    style={{ transition: "stroke-dasharray 500ms ease" }}
                  />
                ))}
              </svg>
              <div className={styles.donutCenter}>
                <div>
                  <div className={styles.donutTotal}>{total}</div>
                  <div className={styles.donutLabel}>total</div>
                </div>
              </div>
            </div>
            <div className={styles.legend}>
              {arcs.map((a) => (
                <div key={a.label} className={styles.legendItem}>
                  <span>
                    <span className={styles.legendDot} style={{ background: a.color }} />
                    {a.label}
                  </span>
                  <strong>
                    {a.value}{" "}
                    <span className={styles.gapPct}>{pct(a.value)}</span>
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>
                <FileEdit size={14} style={{ display: "inline", marginRight: 8, color: "rgb(var(--accent))" }} />
                Governance gaps
              </div>
            </div>
            <div className={styles.gapsList}>
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>Missing definition</span>
                <span><span className={styles.gapCount}>{missingDef}</span><span className={styles.gapPct}>{pct(missingDef)}</span></span>
              </div>
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>Missing formula</span>
                <span><span className={styles.gapCount}>{missingFormula}</span><span className={styles.gapPct}>{pct(missingFormula)}</span></span>
              </div>
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>Missing limitations</span>
                <span><span className={styles.gapCount}>{missingLim}</span><span className={styles.gapPct}>{pct(missingLim)}</span></span>
              </div>
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>Unassigned owner</span>
                <span><span className={styles.gapCount}>{unassigned}</span><span className={styles.gapPct}>{pct(unassigned)}</span></span>
              </div>
              <div className={styles.gapRow}>
                <span className={styles.gapLabel}>Unknown source</span>
                <span><span className={styles.gapCount}>{noSource}</span><span className={styles.gapPct}>{pct(noSource)}</span></span>
              </div>
            </div>
            {missingDef + missingFormula + missingLim > 0 && (
              <Link href={base} className="btn btn-soft btn-block" style={{ marginTop: 12 }}>
                Auto-document with AI →
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
