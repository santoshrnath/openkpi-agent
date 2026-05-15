"use client";

import styles from "./Sparkline.module.css";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  showArea?: boolean;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  width = 140,
  height = 40,
  positive = true,
  showArea = true,
  strokeWidth = 1.75,
}: Props) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const stepX = w / (data.length - 1 || 1);

  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y] as const;
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");

  const areaPath = `${path} L${(pad + w).toFixed(1)},${(pad + h).toFixed(1)} L${pad.toFixed(1)},${(pad + h).toFixed(1)} Z`;

  const stroke = positive ? "rgb(5,150,105)" : "rgb(225,29,72)";
  const fill = positive
    ? "rgba(5,150,105,0.12)"
    : "rgba(225,29,72,0.12)";

  return (
    <div className={styles.wrap} style={{ width, height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={styles.svg}
      >
        {showArea && <path d={areaPath} fill={fill} />}
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1][0]}
            cy={points[points.length - 1][1]}
            r={2.5}
            fill={stroke}
          />
        )}
      </svg>
    </div>
  );
}
