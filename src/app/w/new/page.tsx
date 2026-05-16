"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Sparkles, LogIn } from "lucide-react";
import styles from "./page.module.css";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export default function NewWorkspacePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className={styles.shell}>
        <div className={`card ${styles.card}`}>Loading…</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={styles.shell}>
        <div className={`card ${styles.card}`}>
          <h1 className={styles.title}>
            <Sparkles size={20} style={{ display: "inline", marginRight: 8, color: "rgb(var(--accent))" }} />
            Create a workspace
          </h1>
          <p className={styles.sub}>
            Sign in to create your own private workspace.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Link href={`/sign-in?redirect_url=${encodeURIComponent("/w/new")}`} className="btn btn-primary">
              <LogIn size={14} /> Sign in
            </Link>
            <Link href="/w/demo" className="btn btn-ghost">
              ← Back to the public demo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <NewWorkspaceForm router={router} />;
}

function NewWorkspaceForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EUR" | "GBP" | "INR" | "AED">("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalSlug = slug || slugify(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: finalSlug, tagline, currency }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      router.push(`/w/${data.workspace.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={`card ${styles.card}`}>
        <h1 className={styles.title}>
          <Sparkles size={20} style={{ display: "inline", marginRight: 8, color: "rgb(var(--accent))" }} />
          Create a workspace
        </h1>
        <p className={styles.sub}>
          A workspace holds your KPI catalogue, lineage, AI conversations and
          audit history. You can rebrand and customise it after creation.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={submit}>
          <div className={styles.row}>
            <label className={styles.label}>Workspace name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Finance"
              required
              autoFocus
            />
            <div className={styles.hint}>
              URL: <span className={styles.slugPreview}>/w/{finalSlug || "your-slug"}</span>
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Slug (URL segment)</label>
            <input
              className="input"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder={slugify(name) || "acme-finance"}
              pattern="[a-z0-9-]+"
            />
            <div className={styles.hint}>
              Lowercase letters, digits, and hyphens. Auto-filled from the name.
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Tagline (optional)</label>
            <input
              className="input"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One line about what this workspace is for"
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Default currency</label>
            <select
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
            >
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>INR</option>
              <option>AED</option>
            </select>
          </div>

          <div className={styles.actions}>
            <Link href="/w/demo" className="btn btn-ghost">
              ← Back to demo
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name || !finalSlug || submitting}
            >
              {submitting ? "Creating…" : "Create workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
