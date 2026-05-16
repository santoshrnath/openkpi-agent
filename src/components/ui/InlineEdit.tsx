"use client";

import { useEffect, useRef, useState } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { cx } from "@/lib/utils";
import styles from "./InlineEdit.module.css";

type Status = "idle" | "saving" | "saved" | "error";

interface BaseProps {
  value: string;
  onSave: (next: string) => Promise<void>;
  /** Disables editing entirely. */
  readOnly?: boolean;
  /** Shown when value is empty (and not editing). Click-to-edit still works. */
  placeholder?: string;
  /** Monospace font (for formulas). */
  code?: boolean;
  className?: string;
}

export function InlineText(props: BaseProps) {
  return <Inline {...props} multiline={false} />;
}

export function InlineTextarea(props: BaseProps) {
  return <Inline {...props} multiline={true} />;
}

function Inline({
  value,
  onSave,
  readOnly,
  placeholder,
  code,
  className,
  multiline,
}: BaseProps & { multiline: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stay in sync if the parent re-renders with a new server value
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = (inputRef.current.value ?? "").length;
      try {
        (inputRef.current as HTMLInputElement).setSelectionRange(len, len);
      } catch {/* ignore: setSelectionRange not supported on some types */}
    }
  }, [editing]);

  async function commit(next: string) {
    if (next === value) {
      setEditing(false);
      return;
    }
    setStatus("saving");
    setErrorMsg(null);
    try {
      await onSave(next);
      setStatus("saved");
      setEditing(false);
      setTimeout(() => setStatus("idle"), 1400);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }

  if (editing) {
    return (
      <div className={cx(styles.wrap, code && styles.code, className)}>
        {multiline ? (
          <textarea
            ref={(r) => { inputRef.current = r; }}
            className={styles.editor}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setDraft(value); setEditing(false); }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(draft); }
            }}
            rows={Math.min(8, Math.max(3, (draft.match(/\n/g)?.length ?? 0) + 2))}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={(r) => { inputRef.current = r; }}
            className={styles.editor}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setDraft(value); setEditing(false); }
              if (e.key === "Enter") { e.preventDefault(); commit(draft); }
            }}
            placeholder={placeholder}
          />
        )}
        {status === "saving" && <Loader2 size={12} className={`${styles.status} ${styles.statusSaving}`} />}
        {status === "error" && (
          <AlertCircle
            size={12}
            className={`${styles.status} ${styles.statusError}`}
            aria-label={errorMsg ?? "error"}
          />
        )}
      </div>
    );
  }

  const empty = !value || value.trim() === "";
  return (
    <div className={cx(styles.wrap, code && styles.code, className)}>
      <span
        className={cx(styles.display, readOnly && styles.locked, empty && styles.empty)}
        onClick={() => {
          if (readOnly) return;
          setDraft(value);
          setEditing(true);
        }}
        title={readOnly ? "Read-only — sign in as a member to edit" : "Click to edit"}
      >
        {empty ? (placeholder ?? "—") : value}
      </span>
      {status === "saved" && <Check size={12} className={`${styles.status} ${styles.statusSaved}`} />}
    </div>
  );
}
