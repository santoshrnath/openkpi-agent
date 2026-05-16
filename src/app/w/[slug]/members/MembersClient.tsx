"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

interface Props {
  workspaceSlug: string;
  canAdmin: boolean;
  members: { id: string; role: string; name: string | null; email: string | null; image: string | null }[];
  invitations: { id: string; email: string; role: string; token: string; expiresAt: string }[];
}

const ROLE_CLS: Record<string, string> = {
  ADMIN: styles.roleAdmin,
  STEWARD: styles.roleSteward,
  EDITOR: styles.roleEditor,
  VIEWER: styles.roleViewer,
};

export function MembersClient({ workspaceSlug, canAdmin, members, invitations }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `Request failed (${res.status})`);
      setLink(data.link);
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={`card ${styles.list}`}>
        {members.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "rgb(var(--text-muted))" }}>
            No members yet — invite your first teammate on the right.
          </div>
        ) : (
          members.map((m) => {
            const display = m.name ?? m.email ?? "—";
            const initial = display.slice(0, 1).toUpperCase();
            return (
              <div key={m.id} className={styles.row}>
                <div className={styles.avatar}>{initial}</div>
                <div className={styles.who}>
                  <div className={styles.name}>{m.name ?? "—"}</div>
                  <div className={styles.email}>{m.email ?? "—"}</div>
                </div>
                <span className={cx(styles.role, ROLE_CLS[m.role] ?? styles.roleViewer)}>
                  {m.role.toLowerCase()}
                </span>
              </div>
            );
          })
        )}

        {invitations.length > 0 && (
          <div style={{ padding: "0 20px 16px" }}>
            <div className={styles.email} style={{ marginTop: 14, marginBottom: 6 }}>
              Pending invitations
            </div>
            <div className={styles.pendingList}>
              {invitations.map((i) => (
                <div key={i.id} className={styles.pendingRow}>
                  <span>{i.email}</span>
                  <span style={{ color: "rgb(var(--text-soft))" }}>
                    {i.role.toLowerCase()} · expires {new Date(i.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className={`card ${styles.invitePanel}`}>
        <h3>Invite a teammate</h3>
        <p>
          {canAdmin
            ? "We generate an invite link valid for 14 days. When SMTP is configured, we'll also email it; until then, copy the link from below."
            : "Only Admin members can invite. Ask the workspace admin to send you an invite."}
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={invite}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className="input"
              type="email"
              required
              disabled={!canAdmin || submitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@yourcompany.com"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Role</label>
            <select
              className="input"
              disabled={!canAdmin || submitting}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="VIEWER">Viewer · read-only</option>
              <option value="EDITOR">Editor · can edit KPIs</option>
              <option value="STEWARD">Steward · can certify</option>
              <option value="ADMIN">Admin · can invite + change roles</option>
            </select>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={!canAdmin || !email || submitting}
          >
            <Send size={14} /> {submitting ? "Generating…" : "Send invite"}
          </button>
        </form>

        {link && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 14, color: "rgb(var(--text))" }}>
              Share this link with them:
            </div>
            <div className={styles.invLink}>{link}</div>
            <button
              className="btn btn-soft btn-block"
              onClick={() => navigator.clipboard.writeText(link)}
            >
              Copy link
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
