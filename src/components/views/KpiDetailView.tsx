"use client";

import Link from "next/link";
import {
  ChevronRight,
  Share2,
  Download,
  Sparkles,
  Lightbulb,
  Database,
  Users,
  Clock,
  Layers,
  AlertCircle,
  RefreshCw,
  Wand2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendChart } from "@/components/charts/TrendChart";
import { ConfidenceDial } from "@/components/ui/ConfidenceDial";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiStatusMenu } from "@/components/kpi/KpiStatusMenu";
import { InlineText, InlineTextarea } from "@/components/ui/InlineEdit";
import { formatKPIValue } from "@/lib/utils";
import { cx } from "@/lib/utils";
import { relativeTime } from "@/lib/schedule";
import { KPI } from "@/types";
import styles from "./KpiDetailView.module.css";

const TABS = ["Overview", "Lineage", "Related", "History", "Audit"] as const;

interface Props {
  workspaceSlug: string;
  kpi: KPI;
  aiHint: string;
  isLive?: boolean;
  /** ISO string when set — only present for connector-backed KPIs */
  lastRefreshIso?: string | null;
  /** ISO of the next scheduled auto-refresh, or null for manual cadence */
  nextDueIso?: string | null;
  /** Viewer is a member with at least EDITOR role. */
  canEdit?: boolean;
  /** Viewer is STEWARD or ADMIN — can delete this KPI. */
  canDelete?: boolean;
}

export function KpiDetailView({ workspaceSlug, kpi, aiHint, isLive, lastRefreshIso, nextDueIso, canEdit, canDelete }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/workspaces/${workspaceSlug}/kpis/${kpi.id}/refresh`, {
        method: "POST",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.detail ?? data.error ?? `Refresh failed (${r.status})`);
      } else {
        router.refresh();
      }
    } finally {
      setRefreshing(false);
    }
  }

  const [suggesting, setSuggesting] = useState(false);
  async function suggest() {
    setSuggesting(true);
    try {
      const r = await fetch(`/api/workspaces/${workspaceSlug}/kpis/${kpi.id}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // default: fill only blanks
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.detail ?? data.error ?? `Suggest failed (${r.status})`);
      } else {
        router.refresh();
      }
    } finally {
      setSuggesting(false);
    }
  }

  const needsDocs = !kpi.definition || !kpi.formula || !kpi.limitations;

  const [deleting, setDeleting] = useState(false);
  async function deleteKpi() {
    if (!confirm(`Delete "${kpi.name}"? This removes the KPI, its history, lineage and AI conversations. No undo.`)) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/workspaces/${workspaceSlug}/kpis/${kpi.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.detail ?? data.error ?? `Delete failed (${r.status})`);
        setDeleting(false);
        return;
      }
      router.push(`/w/${workspaceSlug}/catalog`);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  async function patch(payload: Record<string, unknown>) {
    const r = await fetch(`/api/workspaces/${workspaceSlug}/kpis/${kpi.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.detail ?? data.error ?? `Update failed (${r.status})`);
    }
    router.refresh();
  }

  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <Link href={`${base}/catalog`}>KPI Catalog</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>{kpi.name}</span>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {kpi.name}{" "}
            <KpiStatusMenu
              workspaceSlug={workspaceSlug}
              kpiSlug={kpi.id}
              status={kpi.status}
              canEdit={!!canEdit}
            />
          </h1>
          <div className={styles.subline}>
            <span>
              <strong style={{ color: "rgb(var(--text))" }}>{kpi.domain}</strong> · {kpi.owner}
            </span>
            <span>·</span>
            <span>Source: {kpi.sourceSystem}</span>
            <span>·</span>
            <span>Refresh: {kpi.refreshFrequency}</span>
            {isLive && lastRefreshIso && (
              <>
                <span>·</span>
                <span style={{ color: "rgb(5,150,105)" }}>
                  ● Last refresh {relativeTime(new Date(lastRefreshIso))}
                </span>
              </>
            )}
            {isLive && nextDueIso && (
              <>
                <span>·</span>
                <span style={{ color: "rgb(var(--text-soft))" }}>
                  Next auto-tick {relativeTime(new Date(nextDueIso))}
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isLive && (
            <>
              <select
                defaultValue={kpi.refreshFrequency}
                onChange={async (e) => {
                  const v = e.target.value;
                  const r = await fetch(`/api/workspaces/${workspaceSlug}/kpis/${kpi.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshFrequency: v }),
                  });
                  if (r.ok) router.refresh();
                }}
                title="Auto-refresh cadence"
                className="input"
                style={{ width: "auto", padding: "8px 10px", fontSize: 12 }}
              >
                {["Real-time","Every 5 minutes","Every 15 minutes","Every hour","Daily","Weekly","Monthly","Quarterly","Manual"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <button onClick={refresh} disabled={refreshing} className="btn btn-soft">
                <RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
                {refreshing ? "Refreshing…" : "Refresh now"}
              </button>
            </>
          )}
          {needsDocs && (
            <button
              onClick={suggest}
              disabled={suggesting}
              className="btn btn-soft"
              title="Have Claude draft missing definition / formula / limitations"
            >
              <Wand2 size={14} /> {suggesting ? "Drafting…" : "Suggest with AI"}
            </button>
          )}
          <Link href={`${base}/lineage?kpi=${kpi.id}`} className="btn btn-ghost">
            <Layers size={14} /> View lineage
          </Link>
          <button className="btn btn-ghost"><Share2 size={14} /> Share</button>
          <button className="btn btn-primary"><Download size={14} /> Export</button>
          {canDelete && (
            <button
              onClick={deleteKpi}
              disabled={deleting}
              className="btn btn-ghost"
              style={{
                color: "rgb(190,18,60)",
                borderColor: "rgba(225,29,72,0.4)",
              }}
              title="Delete this KPI"
            >
              <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(styles.tab, t === tab && styles.tabActive)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <div className={`card ${styles.metaCard}`}>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Definition</div>
            <div className={styles.metaValue}>
              <InlineTextarea
                value={kpi.definition}
                readOnly={!canEdit}
                placeholder="Click to add a business definition…"
                onSave={(v) => patch({ definition: v })}
              />
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Formula</div>
            <div className={styles.metaValue}>
              <InlineTextarea
                value={kpi.formula}
                readOnly={!canEdit}
                code
                placeholder="Click to add the calculation…"
                onSave={(v) => patch({ formula: v })}
              />
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Source System</div>
            <div className={styles.metaValue} style={{ display: "flex", alignItems: "center" }}>
              <Database size={12} style={{ marginRight: 6, flexShrink: 0 }} />
              <InlineText
                value={kpi.sourceSystem}
                readOnly={!canEdit}
                placeholder="Where does this data come from?"
                onSave={(v) => patch({ sourceSystem: v })}
              />
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Data Owner</div>
            <div className={styles.metaValue} style={{ display: "flex", alignItems: "center" }}>
              <Users size={12} style={{ marginRight: 6, flexShrink: 0 }} />
              <InlineText
                value={kpi.owner}
                readOnly={!canEdit}
                placeholder="Who is accountable?"
                onSave={(v) => patch({ owner: v })}
              />
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Refresh frequency</div>
            <div className={styles.metaValue}>
              <Clock size={12} style={{ display: "inline", marginRight: 6 }} />
              {kpi.refreshFrequency} · last refresh {kpi.lastRefresh}
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Used in dashboards</div>
            <div className={styles.relRow}>
              {kpi.relatedDashboards.map((d) => (
                <span key={d} className={styles.relPill}>{d}</span>
              ))}
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Related KPIs</div>
            <div className={styles.relRow}>
              {kpi.relatedKPIs.map((d) => (
                <span key={d} className={styles.relPill}>{d}</span>
              ))}
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Known limitations</div>
            <div className={styles.metaValue} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertCircle size={14} style={{ color: "rgb(217,119,6)", marginTop: 2, flexShrink: 0 }} />
              <InlineTextarea
                value={kpi.limitations}
                readOnly={!canEdit}
                placeholder="What does this KPI not capture?"
                onSave={(v) => patch({ limitations: v })}
              />
            </div>
          </div>
        </div>

        <div className={styles.center}>
          <div className={`card ${styles.chartCard}`}>
            <div className={styles.chartHead}>
              <div className={styles.chartTitle}>Trend · last 10 periods</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {formatKPIValue(kpi.value, kpi.unit)}
                </div>
                <div style={{ fontSize: 11, color: "rgb(var(--text-soft))" }}>Current period</div>
              </div>
            </div>
            <TrendChart
              data={kpi.history}
              formatValue={(n) => formatKPIValue(n, kpi.unit)}
              height={260}
            />
          </div>

          <div className={`card ${styles.insight}`}>
            <div className={styles.insightIcon}><Lightbulb size={18} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.insightTitle}>Why did this move?</div>
              <div className={styles.insightText}>
                <InlineTextarea
                  value={kpi.whyMoved}
                  readOnly={!canEdit}
                  placeholder="Click to add commentary on this period's movement…"
                  onSave={(v) => patch({ whyMoved: v })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={`card ${styles.aiBlock}`}>
            <div className={styles.aiHead}>
              <Sparkles size={16} style={{ color: "rgb(var(--accent))" }} />
              AI Explanation
            </div>
            <div className={styles.aiCopy}>{aiHint}</div>
            <Link
              href={`${base}/explainer?kpi=${kpi.id}`}
              className="btn btn-soft btn-block"
              style={{ marginTop: 14 }}
            >
              <Sparkles size={14} /> Ask OpenKPI Agent
            </Link>
          </div>

          <div className="card card-pad">
            <ConfidenceDial value={kpi.confidenceScore} />
          </div>

          <div className="card card-pad">
            <div className={styles.aiHead}>
              <Layers size={16} style={{ color: "rgb(var(--accent))" }} />
              Quick actions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <Link href={`${base}/lineage?kpi=${kpi.id}`} className="btn btn-ghost btn-block">View lineage map</Link>
              <Link href={`${base}/explainer?kpi=${kpi.id}`} className="btn btn-ghost btn-block">Ask why it moved</Link>
              <Link href={`${base}/brief`} className="btn btn-ghost btn-block">Add to brief</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
