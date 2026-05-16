import Link from "next/link";
import { Suspense } from "react";
import { authMeta } from "@/lib/auth";
import { LoginClient } from "./LoginClient";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className={styles.shell}>
      <div className={`card ${styles.card}`}>
        <h1 className={styles.title}>Sign in to OpenKPI Studio</h1>
        <p className={styles.sub}>
          Access your private workspaces and KPIs. The demo workspace at{" "}
          <Link href="/w/demo" className="text-accent">/w/demo</Link>{" "}
          is public and doesn’t require sign-in.
        </p>

        <Suspense fallback={null}>
          <LoginClient meta={authMeta} />
        </Suspense>

        {!authMeta.anyProvider && (
          <div className={styles.warn}>
            <strong>No auth providers configured.</strong> Set{" "}
            <code>GOOGLE_CLIENT_ID</code> + <code>GOOGLE_CLIENT_SECRET</code>,
            an SMTP relay, or <code>OPENKPI_DEV_AUTH=true</code> (dev only) to
            enable sign-in.
          </div>
        )}

        {authMeta.hasDev && (
          <div className={styles.warn}>
            <strong>Dev sign-in is enabled.</strong> Any email creates an
            account on the spot. Disable by clearing <code>OPENKPI_DEV_AUTH</code>
            once real auth providers are wired.
          </div>
        )}

        <div className={styles.skip}>
          <Link href="/w/demo">← Continue to the public demo</Link>
        </div>
      </div>
    </div>
  );
}
