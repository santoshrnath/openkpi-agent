"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CheckCircle2, FileEdit, AlertTriangle } from "lucide-react";
import { KPIStatus } from "@/types";
import { cx } from "@/lib/utils";
import styles from "./KpiStatusMenu.module.css";

type IconType = typeof CheckCircle2;

const OPTIONS: { value: KPIStatus; dbValue: string; label: string; cls: string; icon: IconType }[] = [
  { value: "Certified",    dbValue: "CERTIFIED",    label: "Certified",   cls: styles.dotCert,   icon: CheckCircle2 },
  { value: "Draft",        dbValue: "DRAFT",        label: "Draft",       cls: styles.dotDraft,  icon: FileEdit },
  { value: "Needs Review", dbValue: "NEEDS_REVIEW", label: "Needs Review", cls: styles.dotReview, icon: AlertTriangle },
];

interface Props {
  workspaceSlug: string;
  kpiSlug: string;
  status: KPIStatus;
  canEdit: boolean;
}

export function KpiStatusMenu({ workspaceSlug, kpiSlug, status, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = OPTIONS.find((o) => o.value === status) ?? OPTIONS[1];
  const CurIcon = current.icon;

  async function change(opt: (typeof OPTIONS)[number]) {
    if (opt.value === status) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/workspaces/${workspaceSlug}/kpis/${kpiSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: opt.dbValue }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.detail ?? data.error ?? `Update failed (${r.status})`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const badgeCls =
    status === "Certified" ? "badge-certified"
    : status === "Draft"   ? "badge-draft"
                           : "badge-review";

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canEdit) setOpen((o) => !o);
        }}
        className={cx("badge", badgeCls, styles.trigger, !canEdit && styles.lock)}
        title={canEdit ? "Change status" : "Sign in as a member to change status"}
        disabled={busy}
      >
        <CurIcon size={12} />
        {current.label}
        {busy ? <span className={styles.spinner} /> : canEdit && <ChevronDown size={10} />}
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} />
          <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={cx(styles.item, o.value === status && styles.active)}
                onClick={(e) => {
                  e.preventDefault();
                  change(o);
                }}
              >
                <span className={cx(styles.dot, o.cls)} />
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
