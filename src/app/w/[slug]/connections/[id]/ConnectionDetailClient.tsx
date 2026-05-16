"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Save, ArrowRight, ListTree, Trash2 } from "lucide-react";
import styles from "../page.module.css";
import { AiQueryChat } from "./AiQueryChat";

interface QueryResult {
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
}

const DEFAULT_SQL = `-- Return ONE row with ONE numeric column. The value becomes your KPI.
-- Example: total revenue this month.
SELECT 12345.67 AS revenue_this_month`;

function previewSql(kind: string, table: string): string {
  switch (kind) {
    case "MSSQL":
      return `-- Preview ${table}\nSELECT TOP 50 * FROM ${table};`;
    case "BIGQUERY":
      return `-- Preview ${table}\nSELECT * FROM \`${table}\` LIMIT 50;`;
    case "POWERBI":
      return `-- Preview ${table}\nEVALUATE TOPN(50, '${table}')`;
    case "POSTGRES":
    case "SNOWFLAKE":
    default:
      return `-- Preview ${table}\nSELECT * FROM ${table} LIMIT 50;`;
  }
}

export function ConnectionDetailClient({
  workspaceSlug,
  connectionId,
  connectionName,
  connectionKind,
  kpiCount,
  canAdmin,
}: {
  workspaceSlug: string;
  connectionId: string;
  connectionName: string;
  connectionKind: string;
  kpiCount: number;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const apiBase = `/api/workspaces/${workspaceSlug}/connections/${connectionId}`;

  const [tables, setTables] = useState<string[] | null>(null);
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryErr, setQueryErr] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("COUNT");
  const [domain, setDomain] = useState("FINANCE");
  const [goodWhenUp, setGoodWhenUp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/tables`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { tables: string[] }) => setTables(d.tables))
      .catch(() => setTables([]));
  }, [apiBase]);

  async function runQuery() {
    setQueryErr(null);
    setQueryResult(null);
    setQueryLoading(true);
    try {
      const res = await fetch(`${apiBase}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, rowLimit: 50 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Request failed (${res.status})`);
      setQueryResult(data as QueryResult);
    } catch (e) {
      setQueryErr(e instanceof Error ? e.message : String(e));
    } finally {
      setQueryLoading(false);
    }
  }

  const [deleting, setDeleting] = useState(false);
  async function deleteConnection() {
    const msg =
      kpiCount > 0
        ? `Delete "${connectionName}"? ${kpiCount} KPI${kpiCount === 1 ? "" : "s"} backed by this connection will stop auto-refreshing but their metadata + history survive (you can re-attach by creating a new connection). No undo.`
        : `Delete "${connectionName}"? No undo.`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const r = await fetch(apiBase, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.detail ?? data.error ?? `Delete failed (${r.status})`);
        setDeleting(false);
        return;
      }
      router.push(`${base}/connections`);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  async function saveKpi() {
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/kpis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unit, domain, goodWhenUp, sql }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Request failed (${res.status})`);
      router.push(`${base}/catalog/${data.kpi.slug}`);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const firstRow = queryResult?.rows[0] ?? null;
  const firstCell = firstRow ? Object.values(firstRow)[0] : null;
  const firstCellIsNumeric = firstCell != null && Number.isFinite(Number(firstCell));

  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  function handleUseAiSql(generated: string) {
    setSql(generated);
    setQueryResult(null);
    setQueryErr(null);
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      editorRef.current?.focus();
    }, 0);
  }

  return (
    <div className={styles.detailLayout}>
      <div>
        <AiQueryChat apiBase={apiBase} onUseSql={handleUseAiSql} />

        <div className="card" style={{ padding: 20, marginTop: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>
            <Play size={14} style={{ display: "inline", marginRight: 6, color: "rgb(var(--accent))" }} />
            Query — must return one row with a numeric first column
          </h3>
          <textarea
            ref={editorRef}
            className={styles.sqlEditor}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "rgb(var(--text-soft))" }}>
              Read-only — INSERT/UPDATE/DELETE are blocked.
            </div>
            <button onClick={runQuery} className="btn btn-primary" disabled={queryLoading || !sql.trim()}>
              <Play size={14} /> {queryLoading ? "Running…" : "Run query"}
            </button>
          </div>

          {queryErr && (
            <div className={styles.error} style={{ marginTop: 14 }}>
              {queryErr}
            </div>
          )}

          {queryResult && (
            <>
              <div className={styles.preview}>
                <table>
                  <thead>
                    <tr>
                      {queryResult.columns.map((c) => (
                        <th key={c.name}>{c.name} <span style={{ color: "rgb(var(--text-soft))", fontWeight: 400 }}>· {c.type}</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        {queryResult.columns.map((c) => (
                          <td key={c.name}>{String(r[c.name] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11, color: "rgb(var(--text-soft))", marginTop: 6 }}>
                {queryResult.rows.length} row{queryResult.rows.length === 1 ? "" : "s"}{queryResult.truncated && " (truncated)"} · {queryResult.durationMs}ms
              </div>

              {firstCellIsNumeric ? (
                <div className={styles.success} style={{ marginTop: 14 }}>
                  ✓ First column is numeric ({String(firstCell)}). Save this query as a KPI below.
                </div>
              ) : firstCell != null ? (
                <div className={styles.error} style={{ marginTop: 14 }}>
                  The first column must be numeric. Got: <code>{String(firstCell)}</code>. Rewrite to return a number first.
                </div>
              ) : null}
            </>
          )}
        </div>

        {firstCellIsNumeric && (
          <div className="card" style={{ padding: 20, marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>
              <Save size={14} style={{ display: "inline", marginRight: 6, color: "rgb(var(--accent))" }} />
              Save as KPI
            </h3>

            {saveErr && <div className={styles.error}>{saveErr}</div>}

            <div className={styles.kpiForm}>
              <div className={`${styles.field} full`}>
                <span className={styles.label}>KPI name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Revenue This Month" />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Domain</span>
                <select className="input" value={domain} onChange={(e) => setDomain(e.target.value)}>
                  <option value="FINANCE">Finance</option>
                  <option value="HR">HR</option>
                  <option value="PROCUREMENT">Procurement</option>
                  <option value="OPERATIONS">Operations</option>
                  <option value="SALES">Sales</option>
                  <option value="DATA">Data</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Unit</span>
                <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="COUNT">count</option>
                  <option value="CURRENCY">currency ($)</option>
                  <option value="PERCENT">percent (%)</option>
                  <option value="DAYS">days</option>
                  <option value="SCORE">score</option>
                  <option value="RATIO">ratio</option>
                </select>
              </div>
              <div className={`${styles.field} full`}>
                <span className={styles.label}>
                  <input
                    type="checkbox"
                    checked={goodWhenUp}
                    onChange={(e) => setGoodWhenUp(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  Higher value is good (uncheck for things like attrition, cost, cycle time)
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button
                className="btn btn-primary"
                disabled={!name || saving}
                onClick={saveKpi}
              >
                {saving ? "Saving…" : <>Save KPI <ArrowRight size={14} /></>}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`card ${styles.metaPanel}`}>
        <h3>Connection info</h3>
        <div style={{ fontSize: 13, color: "rgb(var(--text-muted))", lineHeight: 1.6 }}>
          {kpiCount} KPI{kpiCount === 1 ? "" : "s"} backed by this connection.
          Every query runs in a read-only transaction with a 10-second statement
          timeout.
        </div>

        {canAdmin && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgb(var(--border-soft))" }}>
            <button
              type="button"
              onClick={deleteConnection}
              disabled={deleting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                background: "transparent",
                color: "rgb(190,18,60)",
                border: "1px solid rgba(225,29,72,0.4)",
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.6 : 1,
              }}
              title={kpiCount > 0
                ? `Removes this connection; ${kpiCount} KPI${kpiCount === 1 ? "" : "s"} stop auto-refreshing but survive as static`
                : "Delete this connection"}
            >
              <Trash2 size={12} /> {deleting ? "Deleting…" : "Delete connection"}
            </button>
            <div style={{ fontSize: 11, color: "rgb(var(--text-soft))", marginTop: 6 }}>
              Admin only · audit-logged.
            </div>
          </div>
        )}

        <h3 style={{ marginTop: 24 }}>
          <ListTree size={14} style={{ display: "inline", marginRight: 6, color: "rgb(var(--accent))" }} />
          Tables ({tables?.length ?? "…"})
        </h3>
        {tables === null ? (
          <div className={styles.hint}>Loading…</div>
        ) : tables.length === 0 ? (
          <div className={styles.hint}>No tables visible to this role.</div>
        ) : (
          <div className={styles.tablesList}>
            {tables.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSql(previewSql(connectionKind, t))}
                title="Click to seed a sample query"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
