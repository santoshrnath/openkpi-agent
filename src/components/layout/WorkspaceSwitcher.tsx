"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Plus, Globe, Lock, Building2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { cx } from "@/lib/utils";
import styles from "./WorkspaceSwitcher.module.css";

interface WorkspaceItem {
  slug: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  tagline: string | null;
  role: "ADMIN" | "STEWARD" | "EDITOR" | "VIEWER";
}

function currentSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/w\/([^/]+)/);
  return m?.[1] ?? null;
}

export function WorkspaceSwitcher() {
  const pathname = usePathname();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WorkspaceItem[] | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const slug = currentSlug(pathname);

  // Fetch on first open (cheap, but no point hitting it on every render).
  // Re-fetch when the session changes (sign in / sign out).
  useEffect(() => {
    if (!open) return;
    if (loadedFor === status) return;
    fetch("/api/me/workspaces")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { workspaces: WorkspaceItem[] }) => {
        setItems(d.workspaces);
        setLoadedFor(status);
      })
      .catch(() => {
        setItems([]);
        setLoadedFor(status);
      });
  }, [open, status, loadedFor]);

  const current = items?.find((w) => w.slug === slug);

  return (
    <div className={styles.switcher}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 size={14} />
        <div className={styles.body}>
          <div className={styles.kicker}>Workspace</div>
          <div className={styles.label}>
            {slug ? (current?.name ?? slug) : "Select a workspace"}
          </div>
        </div>
        <ChevronsUpDown size={14} className={styles.chevron} />
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
            {items === null ? (
              <div className={styles.empty}>Loading…</div>
            ) : items.length === 0 ? (
              <div className={styles.empty}>
                {status === "authenticated"
                  ? "You're not a member of any workspaces yet."
                  : "Sign in to see your workspaces."}
              </div>
            ) : (
              <>
                <div className={styles.section}>Your workspaces</div>
                {items.map((w) => (
                  <Link
                    key={w.slug}
                    href={`/w/${w.slug}`}
                    onClick={() => setOpen(false)}
                    className={cx(styles.item, w.slug === slug && styles.active)}
                  >
                    {w.visibility === "PUBLIC" ? (
                      <Globe size={12} className={styles.dot} style={{ background: "transparent" }} />
                    ) : (
                      <Lock size={12} />
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.name}
                    </span>
                    <span className={styles.role}>{w.role.toLowerCase()}</span>
                  </Link>
                ))}
              </>
            )}
            <Link
              href="/w/new"
              onClick={() => setOpen(false)}
              className={styles.cta}
            >
              <Plus size={14} /> New workspace
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
