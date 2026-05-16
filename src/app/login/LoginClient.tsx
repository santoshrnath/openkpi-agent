"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import styles from "./page.module.css";

const ERROR_MAP: Record<string, string> = {
  CredentialsSignin: "Sign-in failed. Check the email and try again.",
  AccessDenied: "Access denied.",
  Configuration: "Auth provider misconfigured. Check server env vars.",
  Verification: "The sign-in link expired or was already used. Send a new one.",
};

interface Props {
  meta: {
    hasGoogle: boolean;
    hasEmail: boolean;
    hasDev: boolean;
    anyProvider: boolean;
  };
}

export function LoginClient({ meta }: Props) {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const error = params.get("error");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <>
      {error && <div className={styles.error}>{ERROR_MAP[error] ?? `Sign-in error: ${error}`}</div>}

      {meta.hasGoogle && (
        <button
          className={styles.providerBtn}
          onClick={() => {
            setBusy("google");
            signIn("google", { callbackUrl });
          }}
          disabled={!!busy}
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-13l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.2 5.3C41 35.5 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </button>
      )}

      {meta.hasEmail && (
        <>
          {meta.hasGoogle && <div className={styles.divider}>or</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy("email");
              signIn("email", { email, callbackUrl });
            }}
          >
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
              />
            </div>
            <button type="submit" className={`${styles.providerBtn} btn-primary`} disabled={!email || !!busy}>
              <Mail size={16} /> Send magic link
            </button>
          </form>
        </>
      )}

      {meta.hasDev && (
        <>
          {(meta.hasGoogle || meta.hasEmail) && <div className={styles.divider}>or dev mode</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy("dev");
              signIn("dev", { email, name, callbackUrl });
            }}
          >
            <div className={styles.field}>
              <label className={styles.label}>Email (dev)</label>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Display name (optional)</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-derived from email if blank"
              />
            </div>
            <button type="submit" className={styles.providerBtn} disabled={!email || !!busy}>
              {busy === "dev" ? "Signing in…" : "Sign in (dev)"}
            </button>
          </form>
        </>
      )}
    </>
  );
}
