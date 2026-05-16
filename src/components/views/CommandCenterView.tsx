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
  Upload,
} from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { KPICard } from "@/components/kpi/KPICard";
import { SummaryCard } from "@/components/kpi/SummaryCard";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cx } from "@/lib/utils";
import { KPI } from "@/types";
import styles from "@/app/page.module.css";

const DOMAINS = [
  "All",
  "Finance",
  "HR",
  "Procurement",
  "Operations",
  "Sales",
  "Data",
] as const;
const STATUSES = ["All", "Certified", "Draft", "Needs Review"] as const;

type Domain = (typeof DOMAINS)[number];
type Status = (typeof STATUSES)[number];

interface Props {
  workspaceSlug: string;
  workspaceName: string;
  workspaceTagline?: string | null;
  kpis: KPI[];
}

export function CommandCenterView({
  workspaceSlug,
  workspaceName,
  workspaceTagline,
  kpis,
}: Props) {
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
  }, [kpis, domain, status, search]);

  const total = kpis.length;
  const certified = kpis.filter((k) => k.status === "Certified").length;
  const review = kpis.filter((k) => k.status === "Needs Review").length;
  const avgConf = total === 0 ? 0 : Math.round(
    kpis.reduce((s, k) => s + k.confidenceScore, 0) / total
  );

  const baseHref = `/w/${workspaceSlug}`;

  return (
    <>
      <Hero
        kicker={`Workspace: ${workspaceName}`}
        title={
          <>
            Turn KPI confusion into{" "}
            <span className="gradient-text">trusted business intelligence</span>.
          </>
        }
        subtitle={workspaceTagline ?? settings.workspaceTagline}
        actions={
          <>
            <Link href={`${baseHref}/explainer`} className="btn btn-ghost">
              <Sparkles size={14} /> Ask OpenKPI Agent
            </Link>
            <Link href={`${baseHref}/brief`} className="btn btn-primary">
              Generate Executive Brief
            </Link>
          </>
        }
      />

      {kpis.length === 0 && (
        <div className={styles.banner}>
          <div className={styles.bannerIcon}>
            <Upload size={16} />
          </div>
          <div className={styles.bannerText}>
            <span className={styles.bannerStrong}>This workspace is empty.</span>{" "}
            Upload a CSV of your KPI definitions to populate it.
          </div>
          <Link href={`${baseHref}/import`} className="btn btn-soft btn-sm">
            Upload CSV
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
          hint={total > 0 ? `${Math.round((certified / total) * 100)}% of catalog` : "—"}
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
          value={total > 0 ? `${avgConf}%` : "—"}
          hint={
            avgConf >= 90
              ? "Healthy data foundation"
              : avgConf >= 75
              ? "Some governance gaps"
              : total === 0
              ? "No KPIs yet"
              : "Needs attention"
          }
          icon={ShieldCheck}
          tone={avgConf >= 90 ? "good" : avgConf >= 75 ? "warn" : "danger"}
        />
      </div>

      <div className={styles.filterBar}>
        <div className={styles.chips}>
          {DOMAINS.map((d) => (
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
              {STATUSES.map((s) => (
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
          {kpis.length === 0
            ? "No KPIs in this workspace yet. Upload a CSV or connect a data source to get started."
            : "No KPIs match the current filter."}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((k) => (
            <KPICard key={k.id} kpi={k} workspaceSlug={workspaceSlug} />
          ))}
        </div>
      )}
    </>
  );
}
