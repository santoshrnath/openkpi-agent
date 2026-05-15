"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { KPICard } from "@/components/kpi/KPICard";
import { kpis, domains } from "@/lib/data/kpis";
import { cx } from "@/lib/utils";
import styles from "../page.module.css";

type Domain = (typeof domains)[number];

export default function CatalogPage() {
  const [domain, setDomain] = useState<Domain>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      kpis.filter((k) => {
        if (domain !== "All" && k.domain !== domain) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            k.name.toLowerCase().includes(q) ||
            k.owner.toLowerCase().includes(q) ||
            k.sourceSystem.toLowerCase().includes(q) ||
            k.definition.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [domain, search]
  );

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgb(var(--text-soft))" }}>
        <Link href="/">Command Center</Link>
        <ChevronRight size={12} />
        <span>KPI Catalog</span>
      </div>

      <Hero
        kicker="Catalog"
        title="Every KPI, documented and governed."
        subtitle="Browse the certified KPI library, search definitions, formulas and owners. Click any KPI to open its full governance page."
        actions={
          <input
            placeholder="Search definitions, owners, formulas…"
            className="input"
            style={{ width: 320 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      />

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
        <div style={{ fontSize: 12, color: "rgb(var(--text-soft))" }}>
          Showing {filtered.length} of {kpis.length}
        </div>
      </div>

      <div className={styles.grid}>
        {filtered.map((k) => (
          <KPICard key={k.id} kpi={k} />
        ))}
      </div>
    </>
  );
}
