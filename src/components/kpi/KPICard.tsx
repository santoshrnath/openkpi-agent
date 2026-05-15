"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Database,
  TrendingUp,
} from "lucide-react";
import { KPI } from "@/types";
import { Sparkline } from "@/components/charts/Sparkline";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatChange, formatKPIValue } from "@/lib/utils";
import styles from "./KPICard.module.css";

export function KPICard({ kpi }: { kpi: KPI }) {
  const good =
    kpi.goodWhen === "up"
      ? kpi.trend === "up"
      : kpi.goodWhen === "down"
      ? kpi.trend === "down"
      : true;

  const TrendIcon =
    kpi.trend === "up"
      ? ArrowUpRight
      : kpi.trend === "down"
      ? ArrowDownRight
      : Minus;

  const conf = kpi.confidenceScore;
  const confColor =
    conf >= 90 ? "rgb(5,150,105)" : conf >= 75 ? "rgb(217,119,6)" : "rgb(225,29,72)";

  return (
    <Link href={`/catalog/${kpi.id}`} className={`card ${styles.card}`}>
      <div className={styles.head}>
        <div>
          <div className={styles.name}>{kpi.name}</div>
          <div className={styles.domain}>{kpi.domain}</div>
        </div>
        <div className={styles.iconCircle}>
          <TrendingUp size={16} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "end", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className={styles.value}>
            {formatKPIValue(kpi.value, kpi.unit)}
          </div>
          <div className={styles.deltaRow}>
            <span
              className={styles.delta}
              style={{ color: good ? "rgb(5,150,105)" : "rgb(225,29,72)" }}
            >
              <TrendIcon size={14} />
              {formatChange(kpi.change, kpi.unit)}
            </span>
            <span className={styles.deltaNote}>vs prior period</span>
          </div>
        </div>
        <div className={styles.spark}>
          <Sparkline
            data={kpi.history.map((p) => p.value)}
            positive={good}
            width={120}
            height={40}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusBadge status={kpi.status} />
        <span className={styles.confidence} style={{ color: confColor }}>
          <span className={styles.confDot} style={{ background: confColor }} />
          {conf}% confidence
        </span>
      </div>

      <div className={styles.footer}>
        <span className={styles.source}>
          <Database size={12} />
          {kpi.sourceSystem}
        </span>
        <span className={styles.refresh}>{kpi.owner.split(" — ")[0]}</span>
      </div>
    </Link>
  );
}
