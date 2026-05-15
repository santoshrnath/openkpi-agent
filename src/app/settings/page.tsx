"use client";

import { useState } from "react";
import {
  Palette,
  Building2,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
  Check,
  Shield,
} from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import {
  AccentName,
  ThemeName,
  Density,
  SidebarStyle,
  Currency,
  useTheme,
} from "@/components/providers/ThemeProvider";
import { cx } from "@/lib/utils";
import styles from "./page.module.css";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "ai", label: "AI Provider", icon: Sparkles },
  { id: "data", label: "Data & Reset", icon: Shield },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const THEMES: { id: ThemeName; label: string; gradient: string }[] = [
  { id: "light",     label: "Light",     gradient: "linear-gradient(135deg, #f1f5f9, #ffffff)" },
  { id: "dark",      label: "Dark",      gradient: "linear-gradient(135deg, #0f172a, #1e1b4b)" },
  { id: "midnight",  label: "Midnight",  gradient: "linear-gradient(135deg, #000000, #2e1065)" },
  { id: "slate",     label: "Slate",     gradient: "linear-gradient(135deg, #e2e8f0, #f8fafc)" },
  { id: "solarized", label: "Solarized", gradient: "linear-gradient(135deg, #fef3c7, #fffbeb)" },
];

const ACCENTS: { id: AccentName; rgb: string }[] = [
  { id: "blue", rgb: "rgb(39,70,214)" },
  { id: "indigo", rgb: "rgb(79,70,229)" },
  { id: "violet", rgb: "rgb(124,58,237)" },
  { id: "teal", rgb: "rgb(13,148,136)" },
  { id: "emerald", rgb: "rgb(5,150,105)" },
  { id: "rose", rgb: "rgb(225,29,72)" },
];

const PROVIDERS = [
  {
    id: "mock" as const,
    name: "Mock (default)",
    hint: "Deterministic offline responses. No keys required.",
  },
  {
    id: "openai" as const,
    name: "OpenAI",
    hint: "Plug in an OpenAI key to enable real LLM responses.",
  },
  {
    id: "anthropic" as const,
    name: "Anthropic",
    hint: "Use Claude models for KPI explanations.",
  },
  {
    id: "azure-openai" as const,
    name: "Azure OpenAI",
    hint: "Enterprise: route through your Azure deployment.",
  },
];

export default function SettingsPage() {
  const { settings, setSetting, reset } = useTheme();
  const [section, setSection] = useState<SectionId>("appearance");
  const [showKey, setShowKey] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <>
      <Hero
        kicker="Workspace Settings"
        title="Customize OpenKPI Studio for your team."
        subtitle="Themes, accents, sidebar layout, density, workspace identity and AI provider — every part of the platform is yours to brand."
        actions={
          savedFlash && (
            <span className={styles.successPill}>
              <Check size={12} /> Saved
            </span>
          )
        }
      />

      <div className={styles.layout}>
        <aside className={`card ${styles.sideNav}`}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cx(styles.sideTab, section === s.id && styles.sideTabActive)}
              >
                <Icon size={14} /> {s.label}
              </button>
            );
          })}
        </aside>

        <div className={`card ${styles.section}`}>
          {/* ---- APPEARANCE ---- */}
          {section === "appearance" && (
            <>
              <div className={styles.sectionHead}>
                <h2>Appearance</h2>
                <p className={styles.sectionSub}>
                  Pick a theme, accent color, density and sidebar style. Changes
                  apply instantly and persist to your browser.
                </p>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Theme</span>
                  <span className={styles.fieldHint}>5 built-in themes</span>
                </div>
                <div className={styles.swatchRow}>
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSetting("theme", t.id);
                        flashSaved();
                      }}
                      className={cx(styles.swatch, settings.theme === t.id && styles.active)}
                    >
                      <div
                        className={cx(styles.swatchTile, settings.theme === t.id && styles.active)}
                        style={{ background: t.gradient }}
                      />
                      <span className={styles.swatchName}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Accent color</span>
                  <span className={styles.fieldHint}>Drives buttons, links and highlights</span>
                </div>
                <div className={styles.accentRow}>
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSetting("accent", a.id);
                        flashSaved();
                      }}
                      title={a.id}
                      style={{ background: a.rgb }}
                      className={cx(styles.accent, settings.accent === a.id && styles.active)}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Density</span>
                  <span className={styles.fieldHint}>Compact mode tightens cards & rows</span>
                </div>
                <div className={styles.toggleRow}>
                  {(["comfortable", "compact"] as Density[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setSetting("density", d);
                        flashSaved();
                      }}
                      className={cx(styles.toggle, settings.density === d && styles.active)}
                    >
                      <div className={styles.toggleTitle} style={{ textTransform: "capitalize" }}>
                        {d}
                      </div>
                      <div className={styles.toggleHint}>
                        {d === "comfortable"
                          ? "Roomy spacing — easier to read on big screens."
                          : "Tight spacing — more KPIs visible per scroll."}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Sidebar style</span>
                  <span className={styles.fieldHint}>Show full nav labels or icons-only</span>
                </div>
                <div className={styles.toggleRow}>
                  {(["full", "compact"] as SidebarStyle[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSetting("sidebarStyle", s);
                        flashSaved();
                      }}
                      className={cx(styles.toggle, settings.sidebarStyle === s && styles.active)}
                    >
                      <div className={styles.toggleTitle}>
                        {s === "full" ? "Full sidebar" : "Compact icons-only"}
                      </div>
                      <div className={styles.toggleHint}>
                        {s === "full"
                          ? "Labels visible · 256px"
                          : "Icons only · 80px · save horizontal space"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---- WORKSPACE ---- */}
          {section === "workspace" && (
            <>
              <div className={styles.sectionHead}>
                <h2>Workspace identity</h2>
                <p className={styles.sectionSub}>
                  Rebrand OpenKPI for your team — the workspace name flows into the
                  sidebar, the hero copy adopts your tagline.
                </p>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Workspace name</span>
                <input
                  className="input"
                  value={settings.workspaceName}
                  onChange={(e) => setSetting("workspaceName", e.target.value)}
                />
                <span className={styles.fieldHint}>
                  Shown in the sidebar (split across two lines).
                </span>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Tagline</span>
                <input
                  className="input"
                  value={settings.workspaceTagline}
                  onChange={(e) => setSetting("workspaceTagline", e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Your display name</span>
                <input
                  className="input"
                  value={settings.ownerName}
                  onChange={(e) => setSetting("ownerName", e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Your role</span>
                <input
                  className="input"
                  value={settings.ownerRole}
                  onChange={(e) => setSetting("ownerRole", e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Default currency</span>
                <select
                  className="input"
                  value={settings.currency}
                  onChange={(e) => setSetting("currency", e.target.value as Currency)}
                >
                  {(["USD", "EUR", "GBP", "INR", "AED"] as Currency[]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <span className={styles.fieldHint}>
                  Drives formatting for currency KPIs (Workforce Cost, Procurement Spend).
                </span>
              </div>

              <div className={styles.actions}>
                <button className="btn btn-primary" onClick={flashSaved}>
                  <Check size={14} /> Save changes
                </button>
              </div>
            </>
          )}

          {/* ---- AI ---- */}
          {section === "ai" && (
            <>
              <div className={styles.sectionHead}>
                <h2>AI provider</h2>
                <p className={styles.sectionSub}>
                  OpenKPI ships with deterministic mock responses out-of-the-box, so the
                  product works end-to-end without keys. Switch to a real LLM to power
                  the AI Explainer and Executive Brief with generated narrative.
                </p>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Provider</span>
                <div className={styles.providerGrid}>
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSetting("aiProvider", p.id);
                        flashSaved();
                      }}
                      className={cx(
                        styles.providerCard,
                        settings.aiProvider === p.id && styles.active
                      )}
                    >
                      <div className={styles.providerName}>{p.name}</div>
                      <div className={styles.providerHint}>{p.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>
                    <KeyRound size={12} style={{ display: "inline", marginRight: 6 }} />
                    API key{" "}
                    <span style={{ fontWeight: 400, color: "rgb(var(--text-soft))" }}>
                      ({settings.aiProvider})
                    </span>
                  </span>
                  <span className={styles.fieldHint}>
                    Stored only in your browser&apos;s localStorage. Never sent anywhere by the MVP.
                  </span>
                </div>
                <div className={styles.keyRow}>
                  <input
                    className="input"
                    type={showKey ? "text" : "password"}
                    value={settings.apiKeyClientOnly}
                    onChange={(e) => setSetting("apiKeyClientOnly", e.target.value)}
                    placeholder={
                      settings.aiProvider === "openai"
                        ? "sk-..."
                        : settings.aiProvider === "anthropic"
                        ? "sk-ant-..."
                        : settings.aiProvider === "azure-openai"
                        ? "your-azure-key"
                        : "Not required for mock mode"
                    }
                    disabled={settings.aiProvider === "mock"}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label="toggle visibility"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className={styles.callout}>
                <strong>Open-source deployment note: </strong>
                For production, move the API key to a server-side env var
                (<code>OPENAI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code>) and call
                the LLM from a Next.js route handler instead of from the client. The
                client-side key field in this MVP is convenient for local exploration
                only.
              </div>

              <div className={styles.actions}>
                <button className="btn btn-primary" onClick={flashSaved}>
                  <Check size={14} /> Save changes
                </button>
              </div>
            </>
          )}

          {/* ---- DATA ---- */}
          {section === "data" && (
            <>
              <div className={styles.sectionHead}>
                <h2>Data & reset</h2>
                <p className={styles.sectionSub}>
                  The MVP ships with deterministic mock data and a local-only settings
                  store. Reset clears all customisations and signs you back into defaults.
                </p>
              </div>

              <div className={styles.callout}>
                The OpenKPI roadmap adds CSV/Excel import, a Postgres backend and
                connectors for Power BI / SQL Server. The architecture is ready —
                see <code>docs/architecture.md</code>.
              </div>

              <div className={styles.actions}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (confirm("Reset all workspace customisations to defaults?")) {
                      reset();
                      flashSaved();
                    }
                  }}
                >
                  <Trash2 size={14} /> Reset workspace
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
