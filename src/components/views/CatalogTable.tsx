"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { KpiStatusMenu } from "@/components/kpi/KpiStatusMenu";
import { InlineText } from "@/components/ui/InlineEdit";
import { formatChange, formatKPIValue } from "@/lib/utils";
import { cx } from "@/lib/utils";
import { KPI } from "@/types";
import styles from "./CatalogTable.module.css";

type SortKey = "name" | "domain" | "value" | "change" | "confidence" | "owner" | "source" | "refresh";
type SortDir = "asc" | "desc";

interface Props {
  workspaceSlug: string;
  kpis: KPI[];
  canEdit?: boolean;
}

const COLUMNS: { key: SortKey | "actions"; label: string; numeric?: boolean; sortable?: boolean }[] = [
  { key: "name",       label: "KPI",            sortable: true },
  { key: "value",      label: "Value",          numeric: true, sortable: true },
  { key: "change",     label: "Change",         numeric: true, sortable: true },
  { key: "confidence", label: "Confidence",     numeric: true, sortable: true },
  { key: "owner",      label: "Owner",          sortable: true },
  { key: "source",     label: "Source",         sortable: true },
  { key: "refresh",    label: "Refresh",        sortable: true },
  { key: "actions",    label: "Status" },
];

function compare<T extends KPI>(a: T, b: T, key: SortKey): number {
  switch (key) {
    case "name":       return a.name.localeCompare(b.name);
    case "domain":     return a.domain.localeCompare(b.domain);
    case "value":      return a.value - b.value;
    case "change":     return a.change - b.change;
    case "confidence": return a.confidenceScore - b.confidenceScore;
    case "owner":      return a.owner.localeCompare(b.owner);
    case "source":     return a.sourceSystem.localeCompare(b.sourceSystem);
    case "refresh":    return a.refreshFrequency.localeCompare(b.refreshFrequency);
    default:           return 0;
  }
}

export function CatalogTable({ workspaceSlug, kpis, canEdit }: Props) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    return [...kpis].sort((a, b) => sign * compare(a, b, sortKey));
  }, [kpis, sortKey, sortDir]);

  function clickHeader(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric columns default to descending (highest first), text to ascending.
      const col = COLUMNS.find((c) => c.key === key);
      setSortDir(col?.numeric ? "desc" : "asc");
    }
  }

  async function patch(kpiSlug: string, payload: Record<string, unknown>) {
    const r = await fetch(`/api/workspaces/${workspaceSlug}/kpis/${kpiSlug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.detail ?? data.error ?? `Update failed (${r.status})`);
    }
    router.refresh();
  }

  const base = `/w/${workspaceSlug}`;

  return (
    <div className={`card ${styles.scroller}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const isSorted = col.sortable && col.key === sortKey;
              return (
                <th
                  key={col.key}
                  className={cx(
                    styles.th,
                    isSorted && styles.thSorted,
                    !col.sortable && styles.thStatic
                  )}
                  style={col.numeric ? { textAlign: "right" } : undefined}
                  onClick={() => col.sortable && clickHeader(col.key as SortKey)}
                >
                  {col.label}
                  {col.sortable && (
                    <span className={styles.thArrow}>
                      {isSorted ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((kpi) => {
            const goodMove =
              kpi.goodWhen === "up"
                ? kpi.trend === "up"
                : kpi.goodWhen === "down"
                ? kpi.trend === "down"
                : true;
            const TrendIcon =
              kpi.trend === "up" ? ArrowUpRight : kpi.trend === "down" ? ArrowDownRight : Minus;
            const conf = kpi.confidenceScore;
            const confColor =
              conf >= 90 ? "rgb(5,150,105)" : conf >= 75 ? "rgb(217,119,6)" : "rgb(225,29,72)";

            return (
              <tr key={kpi.id} className={styles.row}>
                <td className={cx(styles.cell, styles.nameCell)}>
                  <Link href={`${base}/catalog/${kpi.id}`} className={styles.linkAway}>
                    <div className={styles.kpiName}>{kpi.name}</div>
                    <div className={styles.kpiDomain}>{kpi.domain}</div>
                  </Link>
                </td>
                <td className={cx(styles.cell, styles.numeric)}>
                  {formatKPIValue(kpi.value, kpi.unit)}
                </td>
                <td className={cx(styles.cell, styles.numeric)}>
                  <span
                    className={
                      kpi.trend === "up"   ? (goodMove ? styles.deltaUp   : styles.deltaDown)
                    : kpi.trend === "down" ? (goodMove ? styles.deltaUp   : styles.deltaDown)
                                           :  styles.deltaFlat
                    }
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end", width: "100%" }}
                  >
                    <TrendIcon size={12} />
                    {formatChange(kpi.change, kpi.unit)}
                  </span>
                </td>
                <td className={cx(styles.cell, styles.numeric)}>
                  <span className={styles.confidence} style={{ color: confColor }}>
                    <span className={styles.confDot} style={{ background: confColor }} />
                    {conf}%
                  </span>
                </td>
                <td className={styles.cell}>
                  <InlineText
                    value={kpi.owner}
                    readOnly={!canEdit}
                    placeholder="Unassigned"
                    onSave={(v) => patch(kpi.id, { owner: v })}
                  />
                </td>
                <td className={styles.cell}>
                  <InlineText
                    value={kpi.sourceSystem}
                    readOnly={!canEdit}
                    placeholder="Unknown"
                    onSave={(v) => patch(kpi.id, { sourceSystem: v })}
                  />
                </td>
                <td className={styles.cell} style={{ color: "rgb(var(--text-muted))" }}>
                  {kpi.refreshFrequency}
                </td>
                <td className={styles.cell}>
                  <KpiStatusMenu
                    workspaceSlug={workspaceSlug}
                    kpiSlug={kpi.id}
                    status={kpi.status}
                    canEdit={!!canEdit}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
