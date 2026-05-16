/**
 * Pretty-print AuditEvent rows for the audit log UI.
 *
 * Each formatter takes the row's metadata (the JSON column written by the API
 * routes) and returns a 1-line summary safe to render as plain text + a
 * lucide icon hint. Unknown action types fall through to a generic JSON dump.
 */
import type { LucideIcon } from "lucide-react";
import {
  Wand2,
  Upload,
  RefreshCw,
  PenSquare,
  Plug,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Mail,
  Users,
  Building2,
} from "lucide-react";

export interface AuditDisplay {
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: "info" | "good" | "warn" | "danger";
}

type Meta = Record<string, unknown> | null | undefined;
const num = (m: Meta, k: string) =>
  m && typeof m[k] === "number" ? (m[k] as number) : null;
const str = (m: Meta, k: string) =>
  m && typeof m[k] === "string" ? (m[k] as string) : null;

export function formatAuditEvent(action: string, metadata: Meta): AuditDisplay {
  switch (action) {
    case "workspace.create":
      return {
        icon: Building2,
        title: "Workspace created",
        detail: `Created “${str(metadata, "name") ?? "—"}” (${str(metadata, "slug") ?? "—"}).`,
        tone: "good",
      };
    case "workspace.update": {
      const changes = (metadata?.changes as Record<string, unknown>) ?? {};
      const keys = Object.keys(changes);
      return {
        icon: PenSquare,
        title: "Workspace updated",
        detail: keys.length === 0
          ? "Workspace updated."
          : `Changed: ${keys.join(", ")}.`,
        tone: "info",
      };
    }
    case "workspace.delete":
      return {
        icon: AlertCircle,
        title: "Workspace deleted",
        detail: `Removed workspace ${str(metadata, "slug") ?? "—"}.`,
        tone: "danger",
      };
    case "workspace.invite":
      return {
        icon: Mail,
        title: "Member invited",
        detail: `Invited ${str(metadata, "email") ?? "—"} as ${(str(metadata, "role") ?? "VIEWER").toLowerCase()}.`,
        tone: "info",
      };
    case "workspace.member.accept":
      return {
        icon: Users,
        title: "Invite accepted",
        detail: `${str(metadata, "email") ?? "—"} joined as ${(str(metadata, "role") ?? "VIEWER").toLowerCase()}.`,
        tone: "good",
      };
    case "workspace.autodocument": {
      const filled = num(metadata, "filled") ?? 0;
      const errors = num(metadata, "errors") ?? 0;
      return {
        icon: Wand2,
        title: "AI auto-documentation",
        detail: `Filled ${filled} KPI${filled === 1 ? "" : "s"}${errors > 0 ? ` · ${errors} errors` : ""}.`,
        tone: errors > 0 ? "warn" : "good",
      };
    }
    case "kpi.import.csv": {
      const created = num(metadata, "created") ?? 0;
      const updated = num(metadata, "updated") ?? 0;
      const errors = num(metadata, "errors") ?? 0;
      return {
        icon: Upload,
        title: "CSV imported",
        detail: `${created} created · ${updated} updated${errors > 0 ? ` · ${errors} errors` : ""}.`,
        tone: errors > 0 ? "warn" : "good",
      };
    }
    case "kpi.create.from-connector":
      return {
        icon: Plug,
        title: "KPI created from connector",
        detail: `New KPI “${str(metadata, "name") ?? "—"}” seeded from a SQL query, initial value ${num(metadata, "initialValue") ?? "—"}.`,
        tone: "good",
      };
    case "kpi.refresh":
    case "kpi.refresh.auto": {
      const prev = num(metadata, "previousValue");
      const cur = num(metadata, "value");
      const trend = str(metadata, "trend");
      const isAuto = action === "kpi.refresh.auto";
      return {
        icon: RefreshCw,
        title: isAuto ? "Auto-refresh" : "Manual refresh",
        detail:
          prev != null && cur != null
            ? `${prev} → ${cur} (${trend?.toLowerCase() ?? "flat"})`
            : "Value refreshed.",
        tone: "info",
      };
    }
    case "kpi.refresh.auto.failed":
      return {
        icon: AlertCircle,
        title: "Auto-refresh failed",
        detail: str(metadata, "error") ?? "Refresh failed.",
        tone: "danger",
      };
    case "kpi.update": {
      const changes = (metadata?.changes as Record<string, unknown>) ?? {};
      const keys = Object.keys(changes);
      return {
        icon: PenSquare,
        title: "KPI edited",
        detail: keys.length === 0 ? "KPI updated." : `Changed: ${keys.join(", ")}.`,
        tone: "info",
      };
    }
    case "kpi.suggest": {
      const fields = Array.isArray(metadata?.updatedFields)
        ? (metadata!.updatedFields as string[])
        : [];
      return {
        icon: Wand2,
        title: "AI documentation filled",
        detail: fields.length > 0
          ? `AI drafted ${fields.join(", ")}.`
          : "AI documentation drafted.",
        tone: "good",
      };
    }
    case "connection.create":
      return {
        icon: Plug,
        title: "Data source connected",
        detail: `${str(metadata, "kind") ?? "—"} · “${str(metadata, "name") ?? "—"}” (${num(metadata, "latencyMs") ?? "?"}ms probe).`,
        tone: "good",
      };
    case "ai.ask":
      return {
        icon: Sparkles,
        title: "AI question",
        detail: str(metadata, "question") ?? "AI conversation.",
        tone: "info",
      };
    default:
      return {
        icon: ShieldCheck,
        title: action,
        detail: metadata ? JSON.stringify(metadata).slice(0, 220) : "—",
        tone: "info",
      };
  }
}
