"use client";

import { signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopBar.module.css";

export function AuthWidget() {
  const { data, status } = useSession();
  const pathname = usePathname() ?? "/";

  if (status === "loading") {
    return <div className={styles.iconBtn} aria-hidden />;
  }

  if (!data?.user) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
        className="btn btn-soft btn-sm"
      >
        <LogIn size={14} /> Sign in
      </Link>
    );
  }

  const initial = (data.user.name ?? data.user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        title={data.user.email ?? ""}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, #d946ef, rgb(var(--accent)))",
          color: "#fff",
          display: "grid", placeItems: "center",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {initial}
      </div>
      <button
        className={styles.iconBtn}
        title="Sign out"
        onClick={() => signOut({ callbackUrl: "/w/demo" })}
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
