"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopBar.module.css";

export function AuthWidget() {
  const pathname = usePathname() ?? "/";
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <div className={styles.iconBtn} aria-hidden />;

  if (!isSignedIn) {
    return (
      <Link
        href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`}
        className="btn btn-soft btn-sm"
      >
        <LogIn size={14} /> Sign in
      </Link>
    );
  }

  return <UserButton />;
}
