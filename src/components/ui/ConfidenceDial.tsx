import styles from "./ConfidenceDial.module.css";

interface Props {
  value: number; // 0..100
  size?: number;
  label?: string;
}

export function ConfidenceDial({ value, size = 88, label }: Props) {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  const tone =
    value >= 90
      ? "rgb(5,150,105)"
      : value >= 75
      ? "rgb(var(--accent))"
      : value >= 60
      ? "rgb(217,119,6)"
      : "rgb(225,29,72)";

  const verdict =
    value >= 90
      ? "High confidence"
      : value >= 75
      ? "Solid"
      : value >= 60
      ? "Use with care"
      : "Low confidence";

  return (
    <div className={styles.wrap}>
      <div className={styles.dial} style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(var(--surface-3))"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className={styles.val}>{value}%</div>
      </div>
      <div className={styles.copy}>
        <div className={styles.label}>{label ?? "Confidence Score"}</div>
        <div className={styles.title} style={{ color: tone }}>
          {verdict}
        </div>
        <div className={styles.note}>
          Composite of data quality, freshness, completeness and definition stability.
        </div>
      </div>
    </div>
  );
}
