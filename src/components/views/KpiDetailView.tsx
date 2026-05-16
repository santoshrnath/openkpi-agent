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
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendChart } from "@/components/charts/TrendChart";
import { ConfidenceDial } from "@/components/ui/ConfidenceDial";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatKPIValue } from "@/lib/utils";
import { cx } from "@/lib/utils";
import { KPI } from "@/types";
import styles from "./KpiDetailView.module.css";

const TABS = ["Overview", "Lineage", "Related", "History", "Audit"] as const;

interface Props {
  workspaceSlug: string;
  kpi: KPI;
  aiHint: string;
  isLive?: boolean;
}

export function KpiDetailView({ workspaceSlug, kpi, aiHint, isLive }: Props) {
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
            {kpi.name} <StatusBadge status={kpi.status} />
          </h1>
          <div className={styles.subline}>
            <span>
              <strong style={{ color: "rgb(var(--text))" }}>{kpi.domain}</strong> · {kpi.owner}
            </span>
            <span>·</span>
            <span>Source: {kpi.sourceSystem}</span>
            <span>·</span>
            <span>Refresh: {kpi.refreshFrequency}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isLive && (
            <button onClick={refresh} disabled={refreshing} className="btn btn-soft">
              <RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          )}
          <Link href={`${base}/lineage?kpi=${kpi.id}`} className="btn btn-ghost">
            <Layers size={14} /> View lineage
          </Link>
          <button className="btn btn-ghost"><Share2 size={14} /> Share</button>
          <button className="btn btn-primary"><Download size={14} /> Export</button>
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
            <div className={styles.metaValue}>{kpi.definition}</div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Formula</div>
            <div className={styles.metaValue}><code>{kpi.formula}</code></div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Source System</div>
            <div className={styles.metaValue}>
              <Database size={12} style={{ display: "inline", marginRight: 6 }} />
              {kpi.sourceSystem}
            </div>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaLabel}>Data Owner</div>
            <div className={styles.metaValue}>
              <Users size={12} style={{ display: "inline", marginRight: 6 }} />
              {kpi.owner}
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
              <span>{kpi.limitations}</span>
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
            <div>
              <div className={styles.insightTitle}>Why did this move?</div>
              <div className={styles.insightText}>{kpi.whyMoved}</div>
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
