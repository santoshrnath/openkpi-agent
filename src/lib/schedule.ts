/**
 * Map a human-readable `refreshFrequency` string to a duration in ms.
 *
 * Returns null for cadences we don't auto-schedule (e.g. "Manual"). KPIs with
 * a null cadence are still refreshable via the "Refresh now" button.
 */
export function cadenceMs(frequency: string | null | undefined): number | null {
  if (!frequency) return null;
  const f = frequency.trim().toLowerCase();
  switch (f) {
    case "real-time":
    case "realtime":
    case "every minute":
      return 60_000;
    case "every 5 minutes":
    case "5 min":
      return 5 * 60_000;
    case "every 15 minutes":
    case "15 min":
      return 15 * 60_000;
    case "every hour":
    case "hourly":
      return 60 * 60_000;
    case "daily":
      return 24 * 60 * 60_000;
    case "weekly":
      return 7 * 24 * 60 * 60_000;
    case "monthly":
      return 30 * 24 * 60 * 60_000;
    case "quarterly":
      return 90 * 24 * 60 * 60_000;
    case "manual":
    case "ad-hoc":
    case "on-demand":
      return null;
    default:
      return null;
  }
}

export function isDue(lastRefresh: Date | null, frequency: string | null | undefined, now: Date = new Date()): boolean {
  const ms = cadenceMs(frequency);
  if (ms == null) return false;
  if (!lastRefresh) return true;
  return now.getTime() - lastRefresh.getTime() >= ms;
}

export function nextRefreshAt(lastRefresh: Date | null, frequency: string | null | undefined): Date | null {
  const ms = cadenceMs(frequency);
  if (ms == null) return null;
  if (!lastRefresh) return new Date();
  return new Date(lastRefresh.getTime() + ms);
}

const RTF: Intl.RelativeTimeFormat | null =
  typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    : null;

/** Human-friendly "5 minutes ago" / "in 2 hours" without a heavy date lib. */
export function relativeTime(then: Date, now: Date = new Date()): string {
  if (!RTF) return then.toISOString();
  const deltaMs = then.getTime() - now.getTime();
  const abs = Math.abs(deltaMs);
  const sign = Math.sign(deltaMs);
  const minutes = abs / 60_000;
  const hours = minutes / 60;
  const days = hours / 24;
  if (minutes < 1) return sign >= 0 ? "in a moment" : "just now";
  if (minutes < 60) return RTF.format(Math.round(sign * minutes), "minute");
  if (hours < 24) return RTF.format(Math.round(sign * hours), "hour");
  if (days < 30) return RTF.format(Math.round(sign * days), "day");
  return then.toLocaleDateString();
}
