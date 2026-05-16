"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Check, Database, Upload } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { SUPPORTED_KINDS } from "@/lib/connectors/kinds";
import { cx } from "@/lib/utils";
import styles from "../page.module.css";

export default function NewConnectionClient() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const base = `/w/${slug}`;

  const [kind, setKind] = useState("POSTGRES");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [extraJson, setExtraJson] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = SUPPORTED_KINDS.find((k) => k.id === kind);
  const isUpload = kind === "CSV" || kind === "EXCEL";
  const accept = kind === "EXCEL"
    ? ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
    : ".csv,text/csv";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let res: Response;
      if (isUpload) {
        if (!csvFile) throw new Error(`Choose a ${kind === "EXCEL" ? "spreadsheet" : "CSV"} file to upload.`);
        const fd = new FormData();
        fd.append("file", csvFile);
        if (name) fd.append("name", name);
        res = await fetch(`/api/workspaces/${slug}/connections`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`/api/workspaces/${slug}/connections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, name, url, extraJson: extraJson || undefined }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Request failed (${res.status})`);
      router.push(`${base}/connections/${data.connection.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.crumbs}>
        <Link href={base}>Command Center</Link>
        <ChevronRight size={12} />
        <Link href={`${base}/connections`}>Data Sources</Link>
        <ChevronRight size={12} />
        <span style={{ color: "rgb(var(--text))" }}>New connection</span>
      </div>

      <Hero
        kicker="Data Sources"
        title="Connect a database."
        subtitle="We test the connection before saving. Credentials are encrypted at rest with AES-256-GCM and decrypted only when running a query."
      />

      <form onSubmit={submit} className={`card ${styles.formCard}`}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <span className={styles.label}>Source type</span>
          <div className={styles.kindGrid}>
            {SUPPORTED_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                disabled={!k.available}
                onClick={() => k.available && setKind(k.id)}
                className={cx(
                  styles.kindCard,
                  !k.available && styles.disabled,
                  kind === k.id && styles.active
                )}
              >
                <Database size={14} style={{ color: "rgb(var(--accent))" }} />
                <strong style={{ fontSize: 13 }}>{k.label}</strong>
                <span className={styles.hint}>
                  {k.available ? "Available" : "On the roadmap"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Connection name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Snowflake — Finance prod"
            maxLength={80}
          />
          <span className={styles.hint}>Shown in the data-sources list. Customers see this name; treat it as a label.</span>
        </div>

        {isUpload ? (
          <div className={styles.field}>
            <span className={styles.label}>
              {kind === "EXCEL" ? "Excel file (.xlsx / .xls)" : "CSV file"}
            </span>
            <label
              htmlFor="csv-file"
              className={styles.kindCard}
              style={{ display: "flex", flexDirection: "column", gap: 6, padding: 18, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Upload size={16} style={{ color: "rgb(var(--accent))" }} />
                <strong style={{ fontSize: 13 }}>
                  {csvFile
                    ? csvFile.name
                    : kind === "EXCEL"
                      ? "Choose an Excel file…"
                      : "Choose a CSV file…"}
                </strong>
              </div>
              {csvFile && (
                <span className={styles.hint}>
                  {(csvFile.size / 1024).toFixed(1)} KB · we&rsquo;ll infer column types from the first 200 rows
                </span>
              )}
              <input
                id="csv-file"
                type="file"
                accept={accept}
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
                required
              />
            </label>
            <span className={styles.hint}>{meta?.urlHelp}</span>
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.label}>Connection URL</span>
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder={meta?.urlPlaceholder ?? ""}
                style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
              />
              <span className={styles.hint}>
                {meta?.urlHelp}{" "}
                Use a <strong>read-only role</strong>.
              </span>
            </div>

            {meta?.extraField && (
              <div className={styles.field}>
                <span className={styles.label}>{meta.extraField.label}</span>
                <textarea
                  className="input"
                  value={extraJson}
                  onChange={(e) => setExtraJson(e.target.value)}
                  required
                  placeholder={meta.extraField.placeholder}
                  rows={8}
                  style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, resize: "vertical" }}
                />
                <span className={styles.hint}>{meta.extraField.help}</span>
              </div>
            )}
          </>
        )}

        <div className={styles.actions}>
          <Link href={`${base}/connections`} className="btn btn-ghost">
            ← Back
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              submitting
              || (isUpload ? !csvFile : (!name || !url || (!!meta?.extraField && !extraJson.trim())))
            }
          >
            {submitting
              ? (isUpload ? "Uploading…" : "Testing…")
              : isUpload
                ? <><Upload size={14} /> Upload &amp; index</>
                : <><Check size={14} /> Test &amp; save</>
            }
          </button>
        </div>
      </form>
    </>
  );
}
