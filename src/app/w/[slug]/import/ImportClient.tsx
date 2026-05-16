"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { cx } from "@/lib/utils";
import { IMPORT_FIELDS } from "@/lib/import/schema";
import styles from "./page.module.css";

interface ImportResponse {
  workspace: { slug: string; name: string };
  totalRows: number;
  created: number;
  updated: number;
  names: string[];
  errors: { rowIndex: number; field?: string; message: string }[];
  unmappedHeaders: string[];
  mapping: Record<string, string | null>;
}

export default function ImportClient() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const base = `/w/${slug}`;

  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setResult(null);
    setUploading(true);

    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError(`Expected a .csv file. Got "${file.name}". Save your Excel sheet as CSV first.`);
      setUploading(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/workspaces/${slug}/import`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data as ImportResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) upload(f);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }

  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>Import KPIs</span>
      </div>

      <Hero
        kicker="Import"
        title={<>Upload your KPI catalogue as <span className="gradient-text">CSV</span>.</>}
        subtitle="One row per KPI. Drag and drop a file below, or download the sample to start from the right shape. Existing KPIs (same slug) are updated; new ones are created."
        actions={
          <a
            href={`/api/workspaces/${slug}/import/sample`}
            download="openkpi-sample.csv"
            className="btn btn-ghost"
          >
            <Download size={14} /> Download sample CSV
          </a>
        }
      />

      <div className={styles.shell}>
        <div>
          {!result && (
            <label
              className={cx("card", styles.dropzone, dragOver && styles.active)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className={styles.iconWrap}>
                {uploading ? <span className={styles.spinner} /> : <UploadCloud size={28} />}
              </div>
              <h3>{uploading ? "Uploading…" : "Drop your CSV here"}</h3>
              <p>or <strong>click to choose</strong> a file from your computer</p>
              <div className={styles.smallActions}>
                Accepts <code>.csv</code> · max 4 MB · ~10,000 rows
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className={styles.fileInput}
                onChange={onPick}
              />
            </label>
          )}

          {error && (
            <div className={`card ${styles.warn}`} style={{ marginTop: 16 }}>
              <strong>Couldn’t process that file: </strong>
              {error}
            </div>
          )}

          {result && (
            <div className={`card ${styles.result}`}>
              <div className={styles.resultHead}>
                <div className={cx(styles.resultIcon, result.errors.length > 0 && result.created + result.updated === 0 && styles.resultIconErr)}>
                  {result.errors.length > 0 && result.created + result.updated === 0
                    ? <AlertTriangle size={20} />
                    : <CheckCircle2 size={20} />}
                </div>
                <div>
                  <div className={styles.resultTitle}>
                    {result.created + result.updated === 0
                      ? "Nothing imported"
                      : `Imported ${result.created + result.updated} KPI${result.created + result.updated === 1 ? "" : "s"}`}
                  </div>
                  <div className={styles.resultSub}>
                    Workspace: <strong>{result.workspace.name}</strong> · {result.totalRows} row{result.totalRows === 1 ? "" : "s"} processed
                  </div>
                </div>
              </div>

              <div className={styles.statRow}>
                <div className={styles.statCell}>
                  <div className={styles.statVal} style={{ color: "rgb(5,150,105)" }}>{result.created}</div>
                  <div className={styles.statLabel}>Created</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statVal} style={{ color: "rgb(var(--accent))" }}>{result.updated}</div>
                  <div className={styles.statLabel}>Updated</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statVal} style={{ color: result.errors.length > 0 ? "rgb(190,18,60)" : "rgb(var(--text-soft))" }}>
                    {result.errors.length}
                  </div>
                  <div className={styles.statLabel}>Errors</div>
                </div>
              </div>

              {result.unmappedHeaders.length > 0 && (
                <div className={styles.warn}>
                  <strong>Ignored columns: </strong>
                  {result.unmappedHeaders.map((h) => <code key={h} style={{ marginRight: 6 }}>{h}</code>)}
                  <div style={{ marginTop: 4 }}>
                    These headers didn’t match any known field. Rename them and re-upload to capture them.
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Row errors
                  </div>
                  <div className={styles.errors}>
                    {result.errors.map((e, i) => (
                      <div key={i} className={styles.errorRow}>
                        <span className={styles.errorRowNum}>Row {e.rowIndex}</span>
                        <span className={styles.errorRowMsg}>
                          {e.field && <span className={styles.errorField}>{e.field}:</span>}
                          {e.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setResult(null);
                    setError(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Upload another
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push(base)}
                >
                  Go to workspace <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className={`card ${styles.docs}`}>
          <div className={styles.docsTitle}>Expected columns</div>
          {IMPORT_FIELDS.map((f) => (
            <div key={f.key} className={styles.field}>
              <div>
                <span className={styles.fieldKey}>{f.key}</span>
                {f.required && <span className={styles.required}>required</span>}
              </div>
              <div className={styles.fieldDoc}>{f.doc}</div>
            </div>
          ))}
          <div className={styles.docsTitle} style={{ marginTop: 4 }}>Tips</div>
          <div className={styles.fieldDoc}>
            Headers are matched case-insensitively. Common synonyms work too
            (e.g. <code>Metric</code> → <code>name</code>, <code>Source</code> →
            <code>source_system</code>). Strip <code>$</code> or <code>%</code>
            from values — both stay parseable.
          </div>
        </aside>
      </div>
    </>
  );
}
