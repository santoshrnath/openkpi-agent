"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Plug, Sparkles, Rocket } from "lucide-react";
import styles from "./Onboarding.module.css";

interface Props {
  workspaceSlug: string;
  workspaceName: string;
}

export function Onboarding({ workspaceSlug, workspaceName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/w/${workspaceSlug}`;

  async function cloneSample() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/workspaces/${workspaceSlug}/seed-sample`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail ?? data.error ?? `Request failed (${r.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className={`card ${styles.shell}`}>
      <div className={styles.kicker}>
        <Rocket size={12} /> Welcome
      </div>
      <h1 className={styles.h1}>Set up {workspaceName} in 60 seconds</h1>
      <p className={styles.sub}>
        Three ways to populate this workspace — start with whichever matches your
        team. You can always switch between or combine all three later.
      </p>

      <div className={styles.tiles}>
        <Link href={`${base}/import`} className={styles.tile}>
          <div className={styles.tileIcon}><Upload size={18} /></div>
          <div className={styles.tileTitle}>Upload CSV / Excel</div>
          <div className={styles.tileSub}>
            Drop your KPI spreadsheet. Headers auto-map (Metric → name, Source →
            source_system, …). Re-uploads refresh values without losing lineage.
          </div>
          <div className={styles.tileEta}>~30 seconds</div>
        </Link>

        <Link href={`${base}/connections/new`} className={styles.tile}>
          <div className={styles.tileIcon}><Plug size={18} /></div>
          <div className={styles.tileTitle}>Connect a database</div>
          <div className={styles.tileSub}>
            Read-only Postgres / Redshift / Aurora. Paste a connection string,
            write SQL that returns a number, save as a live KPI that auto-refreshes.
          </div>
          <div className={styles.tileEta}>~3 minutes</div>
        </Link>

        <button
          onClick={cloneSample}
          disabled={busy}
          className={styles.tile}
          type="button"
        >
          <div className={styles.tileIcon}>{busy ? <span className={styles.spinner} /> : <Sparkles size={18} />}</div>
          <div className={styles.tileTitle}>Use sample data</div>
          <div className={styles.tileSub}>
            Clone the 10 demo KPIs (Revenue, Attrition, Procurement Spend, …) and
            their lineage flows. Best for exploring features without your own data.
          </div>
          <div className={styles.tileEta}>{busy ? "Cloning…" : "1 click"}</div>
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
