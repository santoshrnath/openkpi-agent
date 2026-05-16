"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Check, Database } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { SUPPORTED_KINDS } from "@/lib/connectors/kinds";
import { cx } from "@/lib/utils";
import styles from "../page.module.css";

export default function NewConnectionPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const base = `/w/${slug}`;

  const [kind, setKind] = useState("POSTGRES");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/workspaces/${slug}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, url }),
      });
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

        <div className={styles.field}>
          <span className={styles.label}>Connection URL</span>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder={SUPPORTED_KINDS.find((k) => k.id === kind)?.urlPlaceholder ?? ""}
            style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
          />
          <span className={styles.hint}>
            {SUPPORTED_KINDS.find((k) => k.id === kind)?.urlHelp}{" "}
            Use a <strong>read-only role</strong>.
          </span>
        </div>

        <div className={styles.actions}>
          <Link href={`${base}/connections`} className="btn btn-ghost">
            ← Back
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting || !name || !url}>
            {submitting ? "Testing…" : <><Check size={14} /> Test &amp; save</>}
          </button>
        </div>
      </form>
    </>
  );
}
