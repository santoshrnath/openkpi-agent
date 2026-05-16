import Link from "next/link";
import { Mail } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <div style={{ maxWidth: 460, margin: "80px auto", padding: 20 }}>
      <div className="card" style={{ padding: 36, textAlign: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: "rgb(var(--accent-soft))",
            color: "rgb(var(--accent))",
            display: "grid", placeItems: "center",
            margin: "0 auto 16px",
          }}
        >
          <Mail size={28} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Check your inbox</h1>
        <p style={{ color: "rgb(var(--text-muted))", fontSize: 14, lineHeight: 1.6 }}>
          We sent you a sign-in link. Click it to land on the workspace. The
          link expires in 24 hours.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link href="/login" className="text-accent">← Back to sign-in</Link>
        </p>
      </div>
    </div>
  );
}
