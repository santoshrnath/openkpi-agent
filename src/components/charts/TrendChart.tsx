"use client";

import { useMemo, useState } from "react";
import { cx } from "@/lib/utils";
import styles from "./TrendChart.module.css";

interface Point {
  period: string;
  value: number;
}

interface Props {
  data: Point[];
  formatValue?: (n: number) => string;
  height?: number;
  positive?: boolean;
}

type Period = "All" | "12m" | "6m" | "3m" | "YTD";
const PERIODS: Period[] = ["All", "12m", "6m", "3m", "YTD"];

function applyPeriod(data: Point[], period: Period): Point[] {
  if (period === "All") return data;
  if (period === "YTD") {
    // Period strings look like "May 26" — take everything matching the latest year suffix.
    const latest = data[data.length - 1]?.period ?? "";
    const yearSuffix = latest.split(" ").pop() ?? "";
    if (!yearSuffix) return data;
    return data.filter((p) => p.period.endsWith(yearSuffix));
  }
  // 3m / 6m / 12m: just slice the tail.
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  return data.slice(-months);
}

export function TrendChart({
  data,
  formatValue = (n) => n.toFixed(1),
  height = 240,
  positive = true,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>("All");
  const filtered = useMemo(() => applyPeriod(data, period), [data, period]);
  // ⚠️  Reassign locally so the rest of the body uses the filtered slice.
  const sliced = filtered.length > 0 ? filtered : data;

  const width = 720; // viewBox width, will scale
  const padX = 36;
  const padTop = 16;
  const padBottom = 28;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const values = sliced.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = innerW / (sliced.length - 1 || 1);

  const points = sliced.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + innerH - ((d.value - min) / range) * innerH;
    return { x, y, ...d };
  });

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L${(padX + innerW).toFixed(1)},${(padTop + innerH).toFixed(1)} L${padX.toFixed(1)},${(padTop + innerH).toFixed(1)} Z`;

  const stroke = "rgb(var(--accent))";
  const gridY = 4;

  return (
    <div>
      <div className={styles.periodBar}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setPeriod(p); setHover(null); }}
            className={cx(styles.periodBtn, period === p && styles.active)}
            title={`Show ${p === "All" ? "all periods" : p === "YTD" ? "year-to-date" : `last ${p}`}`}
          >
            {p}
          </button>
        ))}
      </div>
    <div className={styles.wrap} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={styles.svg}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {Array.from({ length: gridY + 1 }).map((_, i) => {
          const y = padTop + (innerH / gridY) * i;
          const v = max - (range / gridY) * i;
          return (
            <g key={i}>
              <line
                x1={padX}
                x2={padX + innerW}
                y1={y}
                y2={y}
                className={styles.axis}
              />
              <text
                x={padX - 8}
                y={y + 3}
                textAnchor="end"
                className={styles.label}
              >
                {formatValue(v)}
              </text>
            </g>
          );
        })}

        {/* area + line */}
        <path d={area} fill="url(#trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* x labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            className={styles.label}
          >
            {i % Math.max(1, Math.floor(points.length / 6)) === 0 ? p.period : ""}
          </text>
        ))}

        {/* hover points */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect
              x={p.x - stepX / 2}
              y={padTop}
              width={stepX}
              height={innerH}
              fill="transparent"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5 : 0}
              fill={stroke}
              stroke="rgb(var(--surface))"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(points[hover].x / width) * 100}%`,
            top: `${(points[hover].y / height) * 100}%`,
          }}
        >
          <strong>{formatValue(points[hover].value)}</strong>
          <span style={{ color: "rgb(var(--text-soft))" }}>
            {points[hover].period}
          </span>
        </div>
      )}
    </div>
    </div>
  );
}
