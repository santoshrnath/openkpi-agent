import { LucideIcon } from "lucide-react";
import styles from "./SummaryCard.module.css";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "good" | "warn" | "danger";
}

export function SummaryCard({ label, value, hint, icon: Icon, tone = "default" }: Props) {
  const toneColor =
    tone === "good"
      ? "rgb(5,150,105)"
      : tone === "warn"
      ? "rgb(217,119,6)"
      : tone === "danger"
      ? "rgb(225,29,72)"
      : "rgb(var(--accent))";

  return (
    <div className={`card ${styles.card}`}>
      <div>
        <div className={styles.label}>{label}</div>
        <div className={styles.value}>{value}</div>
        {hint && <div className={styles.delta}>{hint}</div>}
      </div>
      <div className={styles.icon} style={{ color: toneColor, background: `${toneColor.replace("rgb", "rgba").replace(")", ",0.12)")}` }}>
        <Icon size={18} />
      </div>
    </div>
  );
}
