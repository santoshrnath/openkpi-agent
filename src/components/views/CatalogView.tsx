"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid, Rows3 } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { KPICard } from "@/components/kpi/KPICard";
import { CatalogTable } from "./CatalogTable";
import { cx } from "@/lib/utils";
import { KPI } from "@/types";
import pageStyles from "@/app/page.module.css";
import tableStyles from "./CatalogTable.module.css";

const DOMAINS = ["All","Finance","HR","Procurement","Operations","Sales","Data"] as const;
type Domain = (typeof DOMAINS)[number];
type ViewMode = "grid" | "table";

const STORAGE_KEY = "openkpi.catalog.view";

export function CatalogView({
  workspaceSlug,
  kpis,
  canEdit,
}: {
  workspaceSlug: string;
  kpis: KPI[];
  canEdit?: boolean;
}) {
  const [domain, setDomain] = useState<Domain>("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");

  // Restore preference after hydration so SSR HTML matches first paint.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "grid" || stored === "table") setView(stored);
    } catch { /* ignore */ }
  }, []);

  function setViewPersist(v: ViewMode) {
    setView(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  }

  const filtered = useMemo(() =>
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
    [kpis, domain, search]
  );

  const base = `/w/${workspaceSlug}`;
  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgb(var(--text-soft))" }}>
        <Link href={base}>Command Center</Link>
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

      <div className={pageStyles.filterBar}>
        <div className={pageStyles.chips}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={tableStyles.countBadge}>
            Showing {filtered.length} of {kpis.length}
          </span>
          <div className={tableStyles.viewToggle}>
            <button
              type="button"
              onClick={() => setViewPersist("grid")}
              className={cx(tableStyles.viewBtn, view === "grid" && tableStyles.active)}
              title="Grid view"
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              type="button"
              onClick={() => setViewPersist("table")}
              className={cx(tableStyles.viewBtn, view === "table" && tableStyles.active)}
              title="Table view"
            >
              <Rows3 size={14} /> Table
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`card ${pageStyles.empty}`}>No KPIs match the current filter.</div>
      ) : view === "table" ? (
        <CatalogTable workspaceSlug={workspaceSlug} kpis={filtered} canEdit={canEdit} />
      ) : (
        <div className={pageStyles.grid}>
          {filtered.map((k) => (
            <KPICard key={k.id} kpi={k} workspaceSlug={workspaceSlug} canEdit={canEdit} />
          ))}
        </div>
      )}
    </>
  );
}
