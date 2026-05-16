"use client";

import { useState } from "react";
import { Sparkles, Send, Copy } from "lucide-react";
import styles from "../page.module.css";

interface AskResult {
  sql: string;
  explanation: string;
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  truncated?: boolean;
  queryMs?: number;
  durationMs: number;
  model: string;
  error?: string;
  detail?: string;
}

interface Turn {
  question: string;
  result?: AskResult;
  error?: string;
  loading: boolean;
}

const SUGGESTIONS = [
  "How many rows are in the largest table?",
  "Show me a sample of the most recently updated table",
  "Which tables look like they hold revenue or financial data?",
];

export function AiQueryChat({
  apiBase,
  onUseSql,
}: {
  apiBase: string;
  onUseSql: (sql: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    const turn: Turn = { question: q, loading: true };
    setTurns((prev) => [...prev, turn]);
    setQuestion("");

    // Last 6 turns become conversation history for the model.
    const history = turns
      .slice(-6)
      .filter((t) => t.result?.sql)
      .flatMap((t) => [
        { role: "user" as const, content: t.question },
        {
          role: "assistant" as const,
          content: JSON.stringify({ sql: t.result!.sql, explanation: t.result!.explanation }),
        },
      ]);

    try {
      const res = await fetch(`${apiBase}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data: AskResult = await res.json();
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          question: q,
          loading: false,
          result: data,
          error: !res.ok ? data.error ?? `Request failed (${res.status})` : data.error,
        };
        return next;
      });
    } catch (e) {
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          question: q,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className={`card ${styles.chat}`}>
      <div className={styles.chatHead}>
        <Sparkles size={16} style={{ color: "rgb(var(--accent))" }} />
        Ask your data
        <small>Plain English → SQL → result · grounded in this connection&rsquo;s schema</small>
      </div>

      {turns.length === 0 ? (
        <div className={styles.chatHints}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.chatLog}>
          {turns.map((t, i) => (
            <div key={i} className={styles.chatTurn}>
              <div className={styles.chatUser}>{t.question}</div>

              {t.loading && (
                <div className={styles.chatAssistant}>
                  <div className={styles.chatExplain} style={{ color: "rgb(var(--text-soft))" }}>
                    Thinking…
                  </div>
                </div>
              )}

              {!t.loading && t.result && (
                <div className={styles.chatAssistant}>
                  {t.result.explanation && (
                    <div className={styles.chatExplain}>{t.result.explanation}</div>
                  )}

                  {t.result.sql && (
                    <pre className={styles.chatSqlBlock}>{t.result.sql}</pre>
                  )}

                  {t.error && <div className={styles.chatErr}>{t.error}{t.result.detail ? ` — ${t.result.detail}` : ""}</div>}

                  {t.result.columns?.length > 0 && t.result.rows?.length > 0 && (
                    <div className={styles.preview} style={{ marginTop: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            {t.result.columns.map((c) => (
                              <th key={c.name}>
                                {c.name}{" "}
                                <span style={{ color: "rgb(var(--text-soft))", fontWeight: 400 }}>
                                  · {c.type}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.result.rows.slice(0, 20).map((r, ri) => (
                            <tr key={ri}>
                              {t.result!.columns.map((c) => (
                                <td key={c.name}>{String(r[c.name] ?? "")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className={styles.chatMeta}>
                    {t.result.sql && (
                      <>
                        <button type="button" onClick={() => onUseSql(t.result!.sql)}>
                          Use this SQL ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(t.result!.sql)}
                          title="Copy SQL"
                        >
                          <Copy size={11} style={{ display: "inline", marginRight: 4 }} /> Copy
                        </button>
                      </>
                    )}
                    <span>
                      {t.result.rows?.length ?? 0} row{t.result.rows?.length === 1 ? "" : "s"}
                      {t.result.truncated && " (truncated)"} · {t.result.durationMs}ms total ·{" "}
                      {t.result.model}
                    </span>
                  </div>
                </div>
              )}

              {!t.loading && !t.result && t.error && (
                <div className={styles.chatAssistant}>
                  <div className={styles.chatErr}>{t.error}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form className={styles.chatForm} onSubmit={handleSubmit}>
        <textarea
          className={styles.chatInput}
          placeholder="Ask anything about your data — e.g. ‟what was total revenue last month?”"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={2}
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}>
          <Send size={14} /> {busy ? "Asking…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
