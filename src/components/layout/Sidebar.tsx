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
} from "lucide-react";
import { cx } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import styles from "./Sidebar.module.css";

const nav = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/catalog", label: "KPI Catalog", icon: BookMarked },
  { href: "/lineage", label: "Lineage Map", icon: Workflow },
  { href: "/explainer", label: "AI Explainer", icon: Sparkles },
  { href: "/brief", label: "Executive Brief", icon: FileText },
  { href: "/dax-sql", label: "DAX / SQL Explainer", icon: Code2 },
  { href: "/about", label: "About", icon: Info },
];

export function Sidebar() {
  const pathname = usePathname();
  const { settings } = useTheme();
  const compact = settings.sidebarStyle === "compact";

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

      <nav className={styles.nav}>
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
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
        <Link href="/settings" className={styles.profileInner}>
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
