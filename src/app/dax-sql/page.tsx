"use client";

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { explainExpression } from "@/lib/mockAI";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

const SAMPLES: Record<"DAX" | "SQL", string> = {
  DAX: `Revenue YTD =
  TOTALYTD(
    SUM( FactRevenue[Amount] ),
    'Date'[Date]
  )`,
  SQL: `SELECT
  d.region,
  SUM(f.amount) AS total_spend
FROM fact_spend f
JOIN dim_supplier s ON s.supplier_id = f.supplier_id
JOIN dim_geo d      ON d.geo_id      = f.geo_id
WHERE f.posted_date >= '2026-04-01'
  AND f.posted_date <  '2026-05-01'
GROUP BY d.region
ORDER BY total_spend DESC;`,
};

export default function DaxSqlPage() {
  const [lang, setLang] = useState<"DAX" | "SQL">("DAX");
  const [expr, setExpr] = useState(SAMPLES.DAX);
  const [result, setResult] = useState(explainExpression(SAMPLES.DAX));

  function pickLang(l: "DAX" | "SQL") {
    setLang(l);
    setExpr(SAMPLES[l]);
    setResult(explainExpression(SAMPLES[l]));
  }

  return (
    <>
      <Hero
        kicker="DAX / SQL Explainer"
        title="Plain-English translation for measure and query logic."
        subtitle="Paste a DAX measure or SQL query and the agent will explain it line-by-line, flagging filter-context and grain caveats."
      />

      <div className={styles.layout}>
        <div className={`card ${styles.editor}`}>
          <div className={styles.editorHead}>
            <div className={styles.langTabs}>
              {(["DAX", "SQL"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => pickLang(l)}
                  className={cx(styles.langTab, lang === l && styles.langTabActive)}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setExpr(SAMPLES[lang]);
                setResult(explainExpression(SAMPLES[lang]));
              }}
              className="btn btn-ghost btn-sm"
            >
              Load sample
            </button>
          </div>
          <textarea
            className={styles.code}
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder={`Paste your ${lang} here…`}
          />
          <button
            onClick={() => setResult(explainExpression(expr))}
            className="btn btn-primary btn-block"
          >
            <Wand2 size={14} /> Explain this
          </button>
        </div>

        <div className={`card ${styles.explainBox}`}>
          <div className={styles.explainTitle}>
            Explanation
            <span className={styles.langBadge}>
              <Sparkles size={10} /> {result.language}
            </span>
          </div>
          <div className={styles.explainBody}>{result.explanation}</div>
          {result.bullets.length > 0 && (
            <div className={styles.section}>
              <h3>Breakdown</h3>
              <ul>
                {result.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {result.caveats.length > 0 && (
            <div className={styles.section}>
              <h3>Caveats</h3>
              <ul>
                {result.caveats.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
