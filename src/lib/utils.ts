export function cx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

export function formatKPIValue(value: number, unit: string) {
  if (unit === "$") {
    if (Math.abs(value) >= 1_000_000_000)
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000)
      return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "days") return `${value.toFixed(1)} d`;
  if (unit === "score") return value.toFixed(1);
  if (unit === "ratio") return value.toFixed(2);
  if (unit === "count") {
    if (Math.abs(value) >= 1_000_000)
      return `${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  }
  return value.toString();
}

export function formatChange(change: number, unit: string) {
  const sign = change > 0 ? "+" : "";
  if (unit === "%") return `${sign}${change.toFixed(1)} pts`;
  if (unit === "$") {
    const abs = Math.abs(change);
    const s = formatKPIValue(abs, "$");
    return `${change > 0 ? "+" : "−"}${s.replace("$", "$")}`;
  }
  return `${sign}${change.toFixed(2)}`;
}
