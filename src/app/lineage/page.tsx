"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Database,
  Server,
  Wrench,
  Layers3,
  LayoutDashboard,
  Target,
} from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { lineageFlows } from "@/lib/data/lineage";
import { cx } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import styles from "./page.module.css";

const KIND_META: Record<
  string,
  { icon: typeof Database; cls: string; kicker: string }
> = {
  source:    { icon: Database, cls: styles.kindSource, kicker: "Source System" },
  staging:   { icon: Server, cls: styles.kindStaging, kicker: "Staging Layer" },
  transform: { icon: Wrench, cls: styles.kindTransform, kicker: "Transformation" },
  semantic:  { icon: Layers3, cls: styles.kindSemantic, kicker: "Semantic Model" },
  dashboard: { icon: LayoutDashboard, cls: styles.kindDashboard, kicker: "Dashboard" },
  kpi:       { icon: Target, cls: styles.kindKpi, kicker: "KPI" },
};

export default function LineagePage() {
  const [active, setActive] = useState(lineageFlows[0].kpiId);
  const flow = useMemo(
    () => lineageFlows.find((f) => f.kpiId === active) ?? lineageFlows[0],
    [active]
  );

  return (
    <>
      <div className={styles.crumbs}>
        <Link href="/">Command Center</Link>
        <ChevronRight size={12} />
        <span>Lineage Map</span>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>{flow.kpiName}</span>
        <StatusBadge status="Certified" />
      </div>

      <Hero
        kicker="Lineage"
        title="Trace every KPI back to its source."
        subtitle="Visual lineage from source system through staging, transformation, semantic model, dashboard and the certified KPI."
      />

      <div className={styles.flowsTab}>
        {lineageFlows.map((f) => (
          <button
            key={f.kpiId}
            onClick={() => setActive(f.kpiId)}
            className={cx("chip", f.kpiId === active && "chip-active")}
          >
            {f.kpiName}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* ---- Flow visual ---- */}
          <div className={`card ${styles.flowCard}`}>
            <div className={styles.flowHead}>
              <div className={styles.flowTitle}>{flow.kpiName} · end-to-end lineage</div>
              <div style={{ fontSize: 12, color: "rgb(var(--text-soft))" }}>
                {flow.steps.length} steps · refreshed daily 02:00 UTC
              </div>
            </div>
            <div className={styles.steps}>
              {flow.steps.map((s, idx) => {
                const meta = KIND_META[s.kind];
                const Icon = meta.icon;
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "stretch" }}>
                    <div className={styles.step}>
                      <div className={styles.stepKicker}>{meta.kicker}</div>
                      <div className={cx(styles.stepIcon, meta.cls)}>
                        <Icon size={16} />
                      </div>
                      <div className={styles.stepName}>{s.label}</div>
                      <div className={styles.stepDetail}>{s.detail}</div>
                    </div>
                    {idx < flow.steps.length - 1 && (
                      <div className={styles.arrow}>→</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- Detail table ---- */}
          <div className={`card ${styles.tableCard}`}>
            <div className={styles.tableHead}>Lineage details</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Step</th>
                  <th>Description</th>
                  <th>Owner</th>
                  <th>Refresh</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {flow.steps.map((s, i) => {
                  const meta = KIND_META[s.kind];
                  return (
                    <tr key={s.id}>
                      <td style={{ color: "rgb(var(--text-soft))" }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{s.label}</td>
                      <td>{s.detail}</td>
                      <td>{ownerFor(s.kind)}</td>
                      <td>{refreshFor(s.kind)}</td>
                      <td className={styles.statusActive}>● Active</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Insights ---- */}
        <div className={`card ${styles.insightsCard}`}>
          <div className={styles.insightsHead}>Lineage insights</div>

          <div className={styles.insightItem}>
            <div className={styles.insightLabel}>End-to-end refresh</div>
            <div className={styles.insightValue}>Daily · 02:00 UTC</div>
            <div className={styles.insightSub}>SLA: T+5 hours from source close</div>
          </div>

          <div className={styles.insightItem}>
            <div className={styles.insightLabel}>Total steps</div>
            <div className={styles.insightValue}>{flow.steps.length}</div>
            <div className={styles.insightSub}>1 transformation, 1 semantic layer</div>
          </div>

          <div className={styles.insightItem}>
            <div className={styles.insightLabel}>Data quality</div>
            <div className={styles.insightValue} style={{ color: "rgb(5,150,105)" }}>
              98%
            </div>
            <div className={styles.insightSub}>Last failed test: 31 days ago</div>
          </div>

          <div className={styles.insightItem}>
            <div className={styles.insightLabel}>Last validated</div>
            <div className={styles.insightValue}>2026-05-14</div>
            <div className={styles.insightSub}>By {ownerFor("semantic")}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function ownerFor(kind: string) {
  return (
    {
      source: "Procurement IT",
      staging: "Data Engineering",
      transform: "Data Engineering",
      semantic: "Analytics Team",
      dashboard: "Analytics Team",
      kpi: "Procurement Leader",
    }[kind] ?? "—"
  );
}

function refreshFor(kind: string) {
  return (
    {
      source: "Real-time",
      staging: "Hourly",
      transform: "Daily",
      semantic: "Daily",
      dashboard: "Daily",
      kpi: "Daily",
    }[kind] ?? "—"
  );
}
