"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Check,
  Globe,
  Lock,
  Palette,
  Users,
} from "lucide-react";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

interface Workspace {
  name: string;
  tagline: string | null;
  currency: string;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
}

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "visibility", label: "Visibility" },
  { id: "danger", label: "Danger zone" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsClient({
  slug,
  workspace,
  canEdit,
  canAdmin,
}: {
  slug: string;
  workspace: Workspace;
  canEdit: boolean;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const base = `/w/${slug}`;
  const [section, setSection] = useState<SectionId>("general");

  // ── form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState(workspace.name);
  const [tagline, setTagline] = useState(workspace.tagline ?? "");
  const [currency, setCurrency] = useState(workspace.currency);
  const [visibility, setVisibility] = useState(workspace.visibility);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(payload: Partial<Workspace>) {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/workspaces/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Request failed (${res.status})`);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkspace() {
    if (!confirm(`Permanently delete workspace "${workspace.name}"? This removes every KPI, lineage flow, AI conversation, connection, and audit event in it. There is no undo.`)) return;
    try {
      const res = await fetch(`/api/workspaces/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? `Delete failed (${res.status})`);
      }
      router.push("/w/demo");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className={styles.layout}>
      <aside className={`card ${styles.sidenav}`}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cx(styles.sideTab, section === s.id && styles.sideTabActive)}
          >
            {s.label}
          </button>
        ))}
        <div style={{ margin: "10px 0", height: 1, background: "rgb(var(--border-soft))" }} />
        <Link href={`${base}/members`} className={styles.sideTab}>
          <Users size={14} /> Members
        </Link>
        <Link href="/settings" className={styles.sideTab}>
          <Palette size={14} /> Appearance &amp; theme
        </Link>
      </aside>

      <div className={`card ${styles.section}`}>
        {error && <div className={styles.error}>{error}</div>}

        {section === "general" && (
          <>
            <h2 className={styles.h2}>General</h2>
            <p className={styles.sub}>
              Workspace name and tagline appear in the sidebar header, the hero, and
              in the audit log for invitation events.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Workspace name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit || saving}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Tagline</label>
              <input
                className="input"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                disabled={!canEdit || saving}
                placeholder="One line about this workspace"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Default currency</label>
              <select
                className="input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={!canEdit || saving}
              >
                {["USD", "EUR", "GBP", "INR", "AED"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <span className={styles.hint}>
                Formats currency-typed KPIs (Workforce Cost, Procurement Spend, …).
              </span>
            </div>

            <div className={styles.actions}>
              {saved && (
                <span className={styles.savedPill}>
                  <Check size={14} /> Saved
                </span>
              )}
              <button
                onClick={() =>
                  save({
                    name,
                    tagline: tagline || null,
                    currency: currency as Workspace["currency"],
                  })
                }
                disabled={!canEdit || saving}
                className="btn btn-primary"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}

        {section === "visibility" && (
          <>
            <h2 className={styles.h2}>Visibility</h2>
            <p className={styles.sub}>
              Private workspaces require sign-in and explicit membership to view.
              Public workspaces are readable by anyone with the URL — edits still
              require membership.
            </p>

            <div className={styles.visGrid}>
              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                disabled={!canAdmin || saving}
                className={cx(styles.visCard, visibility === "PRIVATE" && styles.active)}
              >
                <h3><Lock size={14} style={{ display: "inline", marginRight: 6 }} /> Private</h3>
                <p>Default. Anonymous viewers are redirected to /sign-in. Only members can read or edit.</p>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("PUBLIC")}
                disabled={!canAdmin || saving}
                className={cx(styles.visCard, visibility === "PUBLIC" && styles.active)}
              >
                <h3><Globe size={14} style={{ display: "inline", marginRight: 6 }} /> Public</h3>
                <p>Anyone with the URL can read. Editing still requires membership. Use for demo / marketing workspaces.</p>
              </button>
            </div>

            <div className={styles.actions}>
              {saved && (
                <span className={styles.savedPill}>
                  <Check size={14} /> Saved
                </span>
              )}
              <button
                onClick={() => save({ visibility })}
                disabled={!canAdmin || saving || visibility === workspace.visibility}
                className="btn btn-primary"
              >
                {saving ? "Saving…" : "Update visibility"}
              </button>
            </div>
            {!canAdmin && (
              <div className={styles.hint} style={{ marginTop: 8 }}>
                Only Admin members can change visibility.
              </div>
            )}
          </>
        )}

        {section === "danger" && (
          <>
            <h2 className={styles.h2}>Danger zone</h2>
            <p className={styles.sub}>
              Permanent operations. There is no undo from the UI — restoring requires
              a database-level backup restore.
            </p>

            <div className={styles.danger}>
              <div className={styles.dangerTitle}>Delete workspace</div>
              <div className={styles.dangerSub}>
                Permanently removes <strong>{workspace.name}</strong> and every
                associated KPI, lineage flow, AI conversation, source connection, and
                audit event. Members lose access immediately.
              </div>
              <button
                className={styles.dangerBtn}
                disabled={!canAdmin || slug === "demo"}
                onClick={deleteWorkspace}
                title={slug === "demo" ? "The demo workspace cannot be deleted." : ""}
              >
                <Trash2 size={14} /> Delete this workspace
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
