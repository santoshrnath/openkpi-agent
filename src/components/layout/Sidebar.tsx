"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookMarked,
  Workflow,
  Sparkles,
  FileText,
  Code2,
  Settings,
  Info,
  Database,
  Upload,
  Users,
  ScrollText,
} from "lucide-react";
import { cx } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import styles from "./Sidebar.module.css";

const NAV = [
  { suffix: "", label: "Command Center", icon: LayoutDashboard, exact: true },
  { suffix: "/catalog", label: "KPI Catalog", icon: BookMarked },
  { suffix: "/connections", label: "Data Sources", icon: Database },
  { suffix: "/import", label: "Import CSV", icon: Upload },
  { suffix: "/lineage", label: "Lineage Map", icon: Workflow },
  { suffix: "/explainer", label: "AI Explainer", icon: Sparkles },
  { suffix: "/brief", label: "Executive Brief", icon: FileText },
  { suffix: "/dax-sql", label: "DAX / SQL Explainer", icon: Code2 },
  { suffix: "/members", label: "Members", icon: Users },
  { suffix: "/audit", label: "Audit log", icon: ScrollText },
  { suffix: "/about", label: "About", icon: Info },
];

function activeWorkspaceSlug(pathname: string | null): string {
  if (!pathname) return "demo";
  const m = pathname.match(/^\/w\/([^/]+)/);
  return m?.[1] ?? "demo";
}

export function Sidebar() {
  const pathname = usePathname();
  const { settings } = useTheme();
  const compact = settings.sidebarStyle === "compact";
  const slug = activeWorkspaceSlug(pathname);
  const base = `/w/${slug}`;

  const nameParts = settings.workspaceName.split(" ");
  const head = nameParts[0] || "OpenKPI";
  const rest = nameParts.slice(1).join(" ") || "Studio";

  return (
    <aside className={cx(styles.sidebar, compact && styles.compact)}>
      <div className={styles.brand}>
        <div className={styles.logo}>K</div>
        {!compact && (
          <div className={styles.brandText}>
            <div className={styles.brandName}>{head}</div>
            <div className={styles.brandKicker}>{rest}</div>
          </div>
        )}
      </div>

      {!compact && <WorkspaceSwitcher />}

      <nav className={styles.nav}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const href = `${base}${item.suffix}`;
          const active = item.exact
            ? pathname === href
            : pathname?.startsWith(href) ?? false;
          return (
            <Link
              key={item.suffix || "/"}
              href={href}
              title={compact ? item.label : undefined}
              className={cx(styles.navItem, active && styles.active)}
            >
              <Icon size={16} />
              {!compact && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={styles.profile}>
        <Link href={`${base}/settings`} className={styles.profileInner}>
          <div className={styles.avatar}>
            {settings.ownerName.charAt(0).toUpperCase()}
          </div>
          {!compact && (
            <>
              <div className={styles.profileText}>
                <div className={styles.profileName}>{settings.ownerName}</div>
                <div className={styles.profileRole}>{settings.ownerRole}</div>
              </div>
              <Settings size={16} className={styles.profileGear} />
            </>
          )}
        </Link>
      </div>
    </aside>
  );
}
