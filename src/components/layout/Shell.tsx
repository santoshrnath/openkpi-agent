"use client";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SessionWrapper } from "@/components/providers/SessionWrapper";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import styles from "./Shell.module.css";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SessionWrapper>
      <ThemeProvider>
        <div className={styles.shell}>
          <Sidebar />
          <div className={styles.body}>
            <TopBar />
            <main className={styles.main}>{children}</main>
            <footer className={styles.footer}>
              OpenKPI Studio · Open-source KPI intelligence workspace · MIT License
            </footer>
          </div>
        </div>
      </ThemeProvider>
    </SessionWrapper>
  );
}
