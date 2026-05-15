"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookMarked,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Filter,
} from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { KPICard } from "@/components/kpi/KPICard";
import { SummaryCard } from "@/components/kpi/SummaryCard";
import { kpis, domains, statuses } from "@/lib/data/kpis";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

type Domain = (typeof domains)[number];
type Status = (typeof statuses)[number];

export default function CommandCenterPage() {
  const { settings } = useTheme();
  const [domain, setDomain] = useState<Domain>("All");
  const [status, setStatus] = useState<Status>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return kpis.filter((k) => {
      if (domain !== "All" && k.domain !== domain) return false;
      if (status !== "All" && k.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          k.name.toLowerCase().includes(q) ||
          k.owner.toLowerCase().includes(q) ||
          k.sourceSystem.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [domain, status, search]);

  const total = kpis.length;
  const certified = kpis.filter((k) => k.status === "Certified").length;
  const review = kpis.filter((k) => k.status === "Needs Review").length;
  const avgConf = Math.round(
    kpis.reduce((s, k) => s + k.confidenceScore, 0) / kpis.length
  );

  return (
    <>
      <Hero
        kicker={`Welcome back, ${settings.ownerName.split(" ")[0]}`}
        title={
          <>
            Turn KPI confusion into <span className="gradient-text">trusted business intelligence</span>.
          </>
        }
        subtitle={settings.workspaceTagline}
        actions={
          <>
            <Link href="/explainer" className="btn btn-ghost">
              <Sparkles size={14} /> Ask OpenKPI Agent
            </Link>
            <Link href="/brief" className="btn btn-primary">
              Generate Executive Brief
            </Link>
          </>
        }
      />

      {settings.aiProvider === "mock" && (
        <div className={styles.banner}>
          <div className={styles.bannerIcon}>
            <Sparkles size={16} />
          </div>
          <div className={styles.bannerText}>
            <span className={styles.bannerStrong}>Mock AI mode is active.</span>{" "}
            Add your API key in{" "}
            <Link href="/settings" className="text-accent">
              workspace settings
            </Link>{" "}
            to switch on real LLM explanations.
          </div>
          <Link href="/settings" className="btn btn-soft btn-sm">
            Connect AI
          </Link>
        </div>
      )}

      <div className={styles.summary}>
        <SummaryCard
          label="Total KPIs"
          value={total.toString()}
          hint={`${certified + kpis.filter((k) => k.status === "Draft").length} actively managed`}
          icon={BookMarked}
        />
        <SummaryCard
          label="Certified KPIs"
          value={certified.toString()}
          hint={`${Math.round((certified / total) * 100)}% of catalog`}
          icon={CheckCircle2}
          tone="good"
        />
        <SummaryCard
          label="Needs Review"
          value={review.toString()}
          hint={review > 0 ? "Action required" : "All clear"}
          icon={AlertTriangle}
          tone={review > 0 ? "warn" : "good"}
        />
        <SummaryCard
          label="Avg. Confidence"
          value={`${avgConf}%`}
          hint={
            avgConf >= 90
              ? "Healthy data foundation"
              : avgConf >= 75
              ? "Some governance gaps"
              : "Needs attention"
          }
          icon={ShieldCheck}
          tone={avgConf >= 90 ? "good" : avgConf >= 75 ? "warn" : "danger"}
        />
      </div>

      <div className={styles.filterBar}>
        <div className={styles.chips}>
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className={cx("chip", domain === d && "chip-active")}
            >
              {d}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div className={styles.statusFilter}>
            <Filter size={14} />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {statuses.map((s) => (
                <option key={s}>{s === "All" ? "All status" : s}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="Filter cards…"
            className="input"
            style={{ width: 200 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`card ${styles.empty}`}>
          No KPIs match the current filter. Try clearing search or selecting{" "}
          <button
            className="text-accent"
            onClick={() => {
              setDomain("All");
              setStatus("All");
              setSearch("");
            }}
          >
            All
          </button>
          .
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((k) => (
            <KPICard key={k.id} kpi={k} />
          ))}
        </div>
      )}
    </>
  );
}
