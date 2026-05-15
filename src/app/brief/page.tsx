"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  ListChecks,
  ClipboardList,
  Database,
  Download,
  Sparkles,
} from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { buildExecutiveBrief } from "@/lib/data/briefs";
import { ExecutiveBrief } from "@/types";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

const SECTIONS = [
  { id: "key", label: "Key Movements", icon: TrendingUp },
  { id: "risks", label: "Risks & Watchouts", icon: AlertTriangle },
  { id: "opps", label: "Opportunities", icon: Lightbulb },
  { id: "actions", label: "Suggested Actions", icon: ListChecks },
  { id: "review", label: "KPIs Needing Review", icon: ClipboardList },
  { id: "dq", label: "Data Quality Notes", icon: Database },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default function BriefPage() {
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [section, setSection] = useState<SectionId>("key");
  const [loading, setLoading] = useState(false);

  function generate() {
    setLoading(true);
    setTimeout(() => {
      setBrief(buildExecutiveBrief());
      setLoading(false);
    }, 700);
  }

  return (
    <>
      <Hero
        kicker="Executive Brief"
        title="Board-ready insights, generated in seconds."
        subtitle="AI-generated executive summary of key business movements, risks, opportunities and data quality notes — for the period in review."
        actions={
          <>
            <span className="chip">
              <Sparkles size={12} /> Period: April → May 2026
            </span>
            <button
              onClick={generate}
              className="btn btn-primary"
              disabled={loading}
            >
              <Sparkles size={14} />
              {loading ? "Generating…" : brief ? "Regenerate" : "Generate Executive Brief"}
            </button>
          </>
        }
      />

      {!brief ? (
        <div className={`card ${styles.empty}`}>
          <h2>No brief generated yet</h2>
          <p>
            Click <strong>Generate Executive Brief</strong> to compose a one-page
            executive summary from the sample KPI portfolio. The MVP uses
            deterministic mock content — connect an LLM in Settings to swap it for
            generated narrative.
          </p>
        </div>
      ) : (
        <div className={styles.layout}>
          <aside className={`card ${styles.tabs}`}>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cx(styles.tab, section === s.id && styles.tabActive)}
                >
                  <span className={styles.tabIcon}>
                    <Icon size={12} />
                  </span>
                  {s.label}
                </button>
              );
            })}
          </aside>

          <section className={`card ${styles.content}`}>
            <div className={styles.contentHead}>
              <div className={styles.contentTitle}>
                {SECTIONS.find((s) => s.id === section)?.label}
              </div>
              <div style={{ fontSize: 12, color: "rgb(var(--text-soft))" }}>
                Period: {brief.period} · Generated {new Date(brief.generatedAt).toLocaleString()}
              </div>
            </div>

            {section === "key" &&
              brief.keyMovements.map((m, i) => {
                const Icon =
                  m.direction === "up"
                    ? TrendingUp
                    : m.direction === "down"
                    ? TrendingDown
                    : Minus;
                const colour =
                  m.direction === "up"
                    ? "rgb(5,150,105)"
                    : m.direction === "down"
                    ? "rgb(225,29,72)"
                    : "rgb(var(--text-muted))";
                return (
                  <div key={i} className={styles.movement}>
                    <div
                      className={styles.movementIcon}
                      style={{
                        background: `${colour.replace("rgb", "rgba").replace(")", ",0.14)")}`,
                        color: colour,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className={styles.movementText}>
                      <span className={styles.movementKpi}>{m.kpi}</span>
                      {m.insight}
                    </div>
                  </div>
                );
              })}

            {section === "risks" && (
              <ul className={styles.list}>
                {brief.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {section === "opps" && (
              <ul className={styles.list}>
                {brief.opportunities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {section === "actions" && (
              <ul className={styles.list}>
                {brief.suggestedActions.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {section === "review" && (
              <ul className={styles.list}>
                {brief.needsReview.map((r, i) => (
                  <li key={i}>{r} — flagged for steward sign-off</li>
                ))}
              </ul>
            )}
            {section === "dq" && (
              <ul className={styles.list}>
                {brief.dataQualityNotes.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </section>

          <aside className={`card ${styles.summary}`}>
            <div className={styles.summaryTitle}>Executive summary</div>
            <p className={styles.summaryBody}>{brief.headline}</p>
            <div className={styles.statRow}>
              <div className={styles.statCell}>
                <div className={styles.statVal}>
                  {brief.keyMovements.filter((m) => m.direction === "up").length}
                </div>
                <div className={styles.statLabel}>Positive moves</div>
              </div>
              <div className={styles.statCell}>
                <div className={styles.statVal}>{brief.risks.length}</div>
                <div className={styles.statLabel}>Risks</div>
              </div>
              <div className={styles.statCell}>
                <div className={styles.statVal}>
                  {brief.suggestedActions.length}
                </div>
                <div className={styles.statLabel}>Actions</div>
              </div>
            </div>
            <button className="btn btn-primary btn-block">
              <Download size={14} /> Download Brief (PDF)
            </button>
            <div style={{ fontSize: 11, color: "rgb(var(--text-soft))", textAlign: "center" }}>
              PDF export is mocked in MVP — wire to a print/export job in production.
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
