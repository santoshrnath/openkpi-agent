"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeName =
  | "light"
  | "dark"
  | "midnight"
  | "slate"
  | "solarized";

export type AccentName =
  | "blue"
  | "indigo"
  | "violet"
  | "teal"
  | "emerald"
  | "rose";

export type Density = "comfortable" | "compact";
export type SidebarStyle = "full" | "compact";
export type Currency = "USD" | "EUR" | "GBP" | "INR" | "AED";

export interface WorkspaceSettings {
  theme: ThemeName;
  accent: AccentName;
  density: Density;
  sidebarStyle: SidebarStyle;
  workspaceName: string;
  workspaceTagline: string;
  ownerName: string;
  ownerRole: string;
  currency: Currency;
  aiProvider: "mock" | "openai" | "anthropic" | "azure-openai";
  /**
   * Never sent anywhere — only persisted to localStorage on the user's machine.
   * The MVP only uses this to gate the UI; switch to a server-side env var in
   * production deployments.
   */
  apiKeyClientOnly: string;
}

const DEFAULTS: WorkspaceSettings = {
  theme: "light",
  accent: "blue",
  density: "comfortable",
  sidebarStyle: "full",
  workspaceName: "OpenKPI Studio",
  workspaceTagline: "AI-powered KPI intelligence for enterprise analytics teams.",
  ownerName: "Arjun Mehta",
  ownerRole: "Data Leader",
  currency: "USD",
  aiProvider: "mock",
  apiKeyClientOnly: "",
};

interface Ctx {
  settings: WorkspaceSettings;
  setSetting: <K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K]
  ) => void;
  reset: () => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "openkpi.workspace.settings.v1";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.accent = settings.accent;
    root.dataset.density = settings.density;
    root.dataset.sidebar = settings.sidebarStyle;
    root.style.colorScheme =
      settings.theme === "dark" || settings.theme === "midnight"
        ? "dark"
        : "light";
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings, hydrated]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      setSetting: (key, value) =>
        setSettings((prev) => ({ ...prev, [key]: value })),
      reset: () => setSettings(DEFAULTS),
      toggleTheme: () =>
        setSettings((prev) => ({
          ...prev,
          theme: prev.theme === "dark" || prev.theme === "midnight" ? "light" : "dark",
        })),
    }),
    [settings]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/* ---- Currency formatter -------------------------------------------------- */
const CURRENCY_LOCALE: Record<Currency, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
  AED: "en-AE",
};

export function formatCurrency(value: number, currency: Currency) {
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
      style: "currency",
      currency,
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}
