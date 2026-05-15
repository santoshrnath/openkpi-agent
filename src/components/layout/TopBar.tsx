"use client";

import { useState } from "react";
import { Bell, Search, Moon, Sun, Palette, Check, Menu } from "lucide-react";
import Link from "next/link";
import {
  AccentName,
  ThemeName,
  useTheme,
} from "@/components/providers/ThemeProvider";
import { cx } from "@/lib/utils";
import styles from "./TopBar.module.css";

const THEMES: { id: ThemeName; label: string; cls: string }[] = [
  { id: "light", label: "Light", cls: styles.themeLight },
  { id: "dark", label: "Dark", cls: styles.themeDark },
  { id: "midnight", label: "Midnight", cls: styles.themeMidnight },
  { id: "slate", label: "Slate", cls: styles.themeSlate },
  { id: "solarized", label: "Solarized", cls: styles.themeSolar },
];

const ACCENTS: { id: AccentName; rgb: string }[] = [
  { id: "blue", rgb: "rgb(39,70,214)" },
  { id: "indigo", rgb: "rgb(79,70,229)" },
  { id: "violet", rgb: "rgb(124,58,237)" },
  { id: "teal", rgb: "rgb(13,148,136)" },
  { id: "emerald", rgb: "rgb(5,150,105)" },
  { id: "rose", rgb: "rgb(225,29,72)" },
];

export function TopBar() {
  const { settings, setSetting, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = settings.theme === "dark" || settings.theme === "midnight";

  return (
    <header className={styles.topbar}>
      <div className={styles.row}>
        <button className={styles.menuBtn}>
          <Menu size={20} />
        </button>

        <div className={styles.search}>
          <Search size={16} />
          <input
            className="input"
            placeholder="Search KPIs, dashboards, owners…"
          />
        </div>

        <div className={styles.chipRow}>
          <span className="chip">
            <span className={styles.statusDot} />
            Mock data
          </span>
        </div>

        <button
          onClick={toggleTheme}
          title="Toggle theme"
          className={styles.iconBtn}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setOpen((o) => !o)}
            title="Theme & accent"
            className={styles.iconBtn}
          >
            <Palette size={16} />
          </button>
          {open && (
            <>
              <div
                className={styles.paletteBackdrop}
                onClick={() => setOpen(false)}
              />
              <div className={cx("card", styles.palettePanel)}>
                <div>
                  <div className={styles.sectionLabel}>Theme</div>
                  <div className={styles.themeGrid}>
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSetting("theme", t.id)}
                        title={t.label}
                        className={cx(
                          styles.themeSwatch,
                          t.cls,
                          settings.theme === t.id && styles.active
                        )}
                      >
                        {settings.theme === t.id && (
                          <Check className={styles.swatchCheck} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className={styles.sectionLabel}>Accent</div>
                  <div className={styles.accentRow}>
                    {ACCENTS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSetting("accent", a.id)}
                        title={a.id}
                        style={{ background: a.rgb }}
                        className={cx(
                          styles.accentDot,
                          settings.accent === a.id && styles.active
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className={styles.sectionLabel}>Density</div>
                  <div className={styles.densityToggle}>
                    {(["comfortable", "compact"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setSetting("density", d)}
                        className={cx(
                          styles.densityBtn,
                          settings.density === d && styles.active
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="btn btn-soft btn-block"
                >
                  Full workspace settings
                </Link>
              </div>
            </>
          )}
        </div>

        <button className={styles.iconBtn}>
          <Bell size={16} />
          <span className={styles.notifDot} />
        </button>
      </div>
    </header>
  );
}
