"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Plus,
  Bot,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Hero } from "@/components/layout/Hero";
import { kpis, getKPI } from "@/lib/data/kpis";
import { generateMockAIResponse } from "@/lib/mockAI";
import { AIMessage } from "@/types";
import { cx } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import styles from "./page.module.css";

const SUGGESTED = [
  "What does this KPI mean?",
  "How is this calculated?",
  "Why did this KPI move?",
  "Which source system is used?",
  "Can leadership trust this number?",
  "What should I check next?",
];

const SEEDED_HISTORY = [
  { id: "h1", title: "Why did attrition increase?", meta: "2 min ago" },
  { id: "h2", title: "What is utilisation?", meta: "15 min ago" },
  { id: "h3", title: "How is revenue calculated?", meta: "1 hour ago" },
  { id: "h4", title: "Which source is used for spend?", meta: "3 hours ago" },
  { id: "h5", title: "Can leadership trust this number?", meta: "5 hours ago" },
];

export default function ExplainerPage() {
  return (
    <Suspense fallback={null}>
      <ExplainerInner />
    </Suspense>
  );
}

function ExplainerInner() {
  const search = useSearchParams();
  const initialKpi = search.get("kpi") ?? "attrition-rate";
  const { settings } = useTheme();

  const [activeKpiId, setActiveKpiId] = useState(initialKpi);
  const [thread, setThread] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const threadEnd = useRef<HTMLDivElement>(null);

  const kpi = useMemo(() => getKPI(activeKpiId), [activeKpiId]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  function send(question: string) {
    const q = question.trim();
    if (!q || !kpi) return;
    const userMsg: AIMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: q,
      createdAt: Date.now(),
    };
    const ai = generateMockAIResponse(q, kpi);
    const agentMsg: AIMessage = {
      id: `a-${Date.now()}`,
      role: "agent",
      content: ai.answer,
      sources: ai.sources,
      confidence: ai.confidence,
      assumptions: ai.assumptions,
      followUps: ai.followUps,
      createdAt: Date.now() + 1,
    };
    setThread((t) => [...t, userMsg, agentMsg]);
    setInput("");
  }

  return (
    <>
      <Hero
        kicker="AI Explainer"
        title={
          <>
            Ask <span className="gradient-text">OpenKPI Agent</span>
          </>
        }
        subtitle="A grounded KPI assistant. Pick a KPI, ask a question, and get an explanation with sources, confidence and assumptions."
        actions={
          settings.aiProvider === "mock" && (
            <span className="chip">
              <Sparkles size={12} /> Mock mode — deterministic responses
            </span>
          )
        }
      />

      <div className={styles.shell}>
        {/* ---- History pane ---- */}
        <aside className={`card ${styles.histPane}`}>
          <div className={styles.histLabel}>Recent conversations</div>
          {SEEDED_HISTORY.map((h, i) => (
            <button
              key={h.id}
              className={cx(styles.histItem, i === 0 && styles.histItemActive)}
            >
              {h.title}
              <div className={styles.histMeta}>{h.meta}</div>
            </button>
          ))}
          <button
            className={styles.newBtn}
            onClick={() => setThread([])}
            style={{ marginTop: 14 }}
          >
            <Plus size={14} /> New conversation
          </button>
        </aside>

        {/* ---- Chat pane ---- */}
        <section className={`card ${styles.chatPane}`}>
          <div className={styles.chatTop}>
            <div className={styles.chatTitle}>
              <div className={styles.aiAvatar}>
                <Bot size={18} />
              </div>
              <div>
                <div className={styles.chatTitleText}>Ask OpenKPI Agent</div>
                <div className={styles.chatSub}>
                  AI-powered KPI assistant · grounded in your governance metadata
                </div>
              </div>
            </div>
            <div className={styles.kpiPicker}>
              KPI:
              <select
                value={activeKpiId}
                onChange={(e) => setActiveKpiId(e.target.value)}
              >
                {kpis.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.thread}>
            {thread.length === 0 && (
              <div className={styles.starter}>
                <h2>Pick a question to start</h2>
                <p>
                  Try a suggested question below or type your own. The agent will
                  answer using the certified definitions, lineage and limitations
                  for the selected KPI.
                </p>
                <div className={styles.followUps} style={{ marginTop: 16, justifyContent: "center" }}>
                  {SUGGESTED.map((q) => (
                    <button key={q} className={styles.followBtn} onClick={() => send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {thread.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className={styles.msgUser}>
                  {m.content}
                </div>
              ) : (
                <div key={m.id} className={styles.msgAgent}>
                  <div className={styles.msgAgentHead}>
                    <div className={styles.aiAvatar} style={{ width: 28, height: 28 }}>
                      <Bot size={14} />
                    </div>
                    <strong style={{ fontSize: 13 }}>OpenKPI Agent</strong>
                    {typeof m.confidence === "number" && (
                      <span
                        className={styles.confBadge}
                        style={{
                          background:
                            m.confidence >= 80
                              ? "rgba(16,185,129,0.15)"
                              : m.confidence >= 60
                              ? "rgba(217,119,6,0.15)"
                              : "rgba(225,29,72,0.15)",
                          color:
                            m.confidence >= 80
                              ? "rgb(5,150,105)"
                              : m.confidence >= 60
                              ? "rgb(217,119,6)"
                              : "rgb(225,29,72)",
                        }}
                      >
                        {m.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <div className={styles.msgAgentBody}>{m.content}</div>
                  <div className={styles.msgMeta}>
                    {m.sources && m.sources.length > 0 && (
                      <div className={styles.metaSection}>
                        <h4>Sources used</h4>
                        <ul>
                          {m.sources.map((s) => (
                            <li key={s}>· {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.assumptions && m.assumptions.length > 0 && (
                      <div className={styles.metaSection}>
                        <h4>Assumptions</h4>
                        <ul>
                          {m.assumptions.map((a) => (
                            <li key={a}>· {a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {m.followUps && (
                    <div className={styles.followUps}>
                      {m.followUps.map((f) => (
                        <button
                          key={f}
                          className={styles.followBtn}
                          onClick={() => send(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
            <div ref={threadEnd} />
          </div>

          <form
            className={styles.inputBar}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask anything about ${kpi?.name ?? "this KPI"}…`}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim()}
              title="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
