import {
  BookMarked,
  Workflow,
  Sparkles,
  FileText,
  ShieldCheck,
  Code2,
  Palette,
  Settings,
} from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import styles from "./page.module.css";

const FEATURES = [
  {
    title: "KPI Command Center",
    body: "A single pane for every KPI: certified, draft, needs-review. Cards show current value, trend, source, owner and confidence — all in one glance.",
    icon: BookMarked,
  },
  {
    title: "KPI Catalog & detail",
    body: "Every KPI has a governance page: definition, formula, source, owner, refresh cadence, related dashboards, limitations and trend.",
    icon: ShieldCheck,
  },
  {
    title: "AI Explainer",
    body: "Ask plain-English questions of any KPI. Get an answer with sources, assumptions and confidence — no hallucinated formulas.",
    icon: Sparkles,
  },
  {
    title: "Lineage Map",
    body: "Trace every KPI from source system through staging, transformation, semantic model, dashboard and KPI — visually.",
    icon: Workflow,
  },
  {
    title: "Executive Brief",
    body: "Generate a board-ready summary of key movements, risks, opportunities and data quality notes for any review cycle.",
    icon: FileText,
  },
  {
    title: "DAX / SQL Explainer",
    body: "Paste a DAX measure or SQL query. Get a plain-English breakdown, with filter-context and grain caveats flagged.",
    icon: Code2,
  },
  {
    title: "Multi-theme platform",
    body: "Five built-in themes (Light, Dark, Midnight, Slate, Solarized), six accent palettes, two densities, customisable sidebar.",
    icon: Palette,
  },
  {
    title: "Fully customisable",
    body: "Rebrand the workspace name, tagline, your display name and currency. Bring your own AI provider key.",
    icon: Settings,
  },
];

export default function AboutPage() {
  return (
    <>
      <Hero
        kicker="About"
        title={
          <>
            <span className="gradient-text">OpenKPI Studio</span> — open-source KPI intelligence.
          </>
        }
        subtitle="Not a chatbot. A KPI governance, lineage and explanation layer for enterprise analytics teams — designed to plug into your existing BI stack."
      />

      <div className={styles.layout}>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className={`card ${styles.feature}`}>
                <div className={styles.featureIcon}>
                  <Icon size={18} />
                </div>
                <div className={styles.featureTitle}>{f.title}</div>
                <div className={styles.featureBody}>{f.body}</div>
              </div>
            );
          })}
        </div>

        <div className={`card ${styles.architecture}`}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Architecture at a glance</h2>
          <p style={{ fontSize: 13, color: "rgb(var(--text-muted))", marginBottom: 18, lineHeight: 1.6 }}>
            OpenKPI sits between your source systems and your dashboards as a
            governance + explanation layer — independent of BI tool, swappable AI
            provider, and friendly to your existing stack.
          </p>
          <div className={styles.archFlow}>
            <div className={styles.archStep}>
              Source systems
              <small>SAP · Workday · Coupa · Salesforce · TM1 · …</small>
            </div>
            <div className={styles.archStep}>
              OpenKPI Knowledge Layer
              <small>KPI definitions, lineage, owners, limitations</small>
            </div>
            <div className={styles.archStep}>
              AI Agent Layer
              <small>Grounded explanations · briefs · DAX/SQL translation</small>
            </div>
            <div className={styles.archStep}>
              Governance Layer
              <small>Certification, audit, confidence scoring</small>
            </div>
            <div className={styles.archStep}>
              User Experience
              <small>Command Center · Catalog · Explainer · Brief</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
