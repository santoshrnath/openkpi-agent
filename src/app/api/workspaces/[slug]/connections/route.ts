import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { PostgresConnector } from "@/lib/connectors/postgres";
import { SnowflakeConnector } from "@/lib/connectors/snowflake";
import { MssqlConnector } from "@/lib/connectors/mssql";
import { BigQueryConnector } from "@/lib/connectors/bigquery";
import { PowerBIConnector } from "@/lib/connectors/powerbi";
import { inferCsvColumns, CsvConfig } from "@/lib/connectors/csv";
import { gateView, gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ─── GET — list connections (without credentials) ────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await gateView(params.slug);
  if (gate instanceof NextResponse) return gate;
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const rows = await prisma.sourceConnection.findMany({
    where: { workspaceId: ws.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, kind: true, name: true, status: true,
      lastSyncAt: true, lastError: true,
      createdAt: true, updatedAt: true,
      _count: { select: { kpis: true } },
    },
  });
  return NextResponse.json({ connections: rows });
}

// ─── POST — create + test ────────────────────────────────────────────────────
const CreateBody = z.object({
  kind: z.enum(["POSTGRES", "SNOWFLAKE", "MSSQL", "BIGQUERY", "POWERBI"]),
  name: z.string().min(1).max(80),
  url: z.string().min(10).max(2000),
  /** Optional kind-specific JSON credentials (BigQuery service-account, Power BI principal) */
  extraJson: z.string().max(20_000).optional(),
}).refine((b) => {
  if (b.kind === "POSTGRES") return /^postgres(ql)?:\/\//.test(b.url);
  if (b.kind === "SNOWFLAKE") return /^snowflake:\/\//.test(b.url);
  if (b.kind === "MSSQL") return /^(mssql|sqlserver):\/\//.test(b.url);
  if (b.kind === "BIGQUERY") return /^bigquery:\/\//.test(b.url);
  if (b.kind === "POWERBI") return /^powerbi:\/\//.test(b.url);
  return false;
}, { message: "URL does not match the selected source type" });

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // ── CSV upload path (multipart/form-data) ────────────────────────────────
  // Parsed and stored as a SourceConnection of kind=CSV with the full row
  // payload in plaintext `config`. The CsvConnector queries it via alasql.
  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    return handleCsvUpload(req, ws.id);
  }

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  // Parse the optional JSON-shaped extras (BigQuery service-account /
  // Power BI principal). Reject early on bad JSON so the user gets a
  // useful error instead of a stack trace from the connector.
  let extra: Record<string, unknown> | undefined;
  if (body.extraJson && body.extraJson.trim()) {
    try {
      extra = JSON.parse(body.extraJson);
    } catch (e) {
      return NextResponse.json(
        { error: "Credentials JSON is not valid JSON", detail: String(e) },
        { status: 400 }
      );
    }
  }

  // Per-kind credential normalisation. Whatever shape we settle on here is
  // what gets encrypted into credentialsCipher and decrypted by makeConnector.
  let credentials: Record<string, unknown>;
  let connector;
  switch (body.kind) {
    case "POSTGRES":
      credentials = { url: body.url };
      connector = new PostgresConnector({ url: body.url });
      break;
    case "SNOWFLAKE":
      credentials = { url: body.url };
      connector = new SnowflakeConnector({ url: body.url });
      break;
    case "MSSQL":
      credentials = { url: body.url };
      connector = new MssqlConnector({ url: body.url });
      break;
    case "BIGQUERY": {
      if (!extra || typeof extra !== "object") {
        return NextResponse.json(
          { error: "BigQuery requires a service-account JSON in the second field." },
          { status: 400 }
        );
      }
      credentials = { url: body.url, serviceAccount: extra };
      try {
        connector = new BigQueryConnector({ url: body.url, serviceAccount: extra });
      } catch (e) {
        return NextResponse.json(
          { error: "BigQuery credentials invalid", detail: e instanceof Error ? e.message : String(e) },
          { status: 400 }
        );
      }
      break;
    }
    case "POWERBI": {
      if (!extra || typeof extra !== "object") {
        return NextResponse.json(
          { error: "Power BI requires { tenantId, clientId, clientSecret } JSON in the second field." },
          { status: 400 }
        );
      }
      const e = extra as Record<string, unknown>;
      if (!e.tenantId || !e.clientId || !e.clientSecret) {
        return NextResponse.json(
          { error: "Power BI credentials must include tenantId, clientId, and clientSecret." },
          { status: 400 }
        );
      }
      credentials = {
        url: body.url,
        tenantId: e.tenantId,
        clientId: e.clientId,
        clientSecret: e.clientSecret,
      };
      try {
        connector = new PowerBIConnector(credentials as unknown as ConstructorParameters<typeof PowerBIConnector>[0]);
      } catch (e) {
        return NextResponse.json(
          { error: "Power BI credentials invalid", detail: e instanceof Error ? e.message : String(e) },
          { status: 400 }
        );
      }
      break;
    }
  }

  const probe = await connector.test();
  if (!probe.ok) {
    return NextResponse.json(
      { error: "Connection failed", detail: probe.message, latencyMs: probe.latencyMs },
      { status: 422 }
    );
  }

  const conn = await prisma.sourceConnection.create({
    data: {
      workspaceId: ws.id,
      kind: body.kind,
      name: body.name,
      status: "CONNECTED",
      credentialsCipher: encryptJson(credentials),
      config: { ssl: probe.ssl ?? false, version: probe.version ?? null },
      lastSyncAt: new Date(),
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "connection.create",
        targetType: "source",
        targetId: conn.id,
        metadata: {
          kind: conn.kind,
          name: conn.name,
          version: probe.version ?? null,
          latencyMs: probe.latencyMs ?? null,
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json(
    {
      connection: { id: conn.id, name: conn.name, kind: conn.kind, status: conn.status },
      probe: { latencyMs: probe.latencyMs, version: probe.version, ssl: probe.ssl },
    },
    { status: 201 }
  );
}

// ─── CSV / Excel upload handler ─────────────────────────────────────────────
// One path for both — once parsed into row objects, the AI chat + alasql
// query path is identical. Detection by content-type + filename extension.
async function handleCsvUpload(req: NextRequest, workspaceId: string) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  const nameInput = (form.get("name") as string | null)?.trim() ?? "";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 8MB). Pre-aggregate or split." },
      { status: 413 }
    );
  }

  const lower = file.name.toLowerCase();
  const isExcel =
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel";
  const kindTag: "CSV" | "EXCEL" = isExcel ? "EXCEL" : "CSV";

  let rows: Record<string, unknown>[] = [];
  let headers: string[] = [];

  if (isExcel) {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Excel file has no sheets." }, { status: 400 });
    }
    const sheet = wb.Sheets[sheetName];
    // defval:"" stops sheet_to_json from skipping blank cells in the middle
    // of a row (it would mis-align columns otherwise).
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: false,
      defval: "",
      blankrows: false,
    });
    rows = data.filter((r) => r && Object.keys(r).length > 0);
    headers = rows[0] ? Object.keys(rows[0]) : [];
  } else {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
    });
    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json(
        { error: "CSV parse failed", detail: parsed.errors[0]?.message ?? "Unknown" },
        { status: 400 }
      );
    }
    rows = parsed.data.filter((r) => r && Object.keys(r).length > 0);
    headers = (parsed.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : [])).filter(
      (h) => h && h.trim()
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: `No rows detected in ${isExcel ? "spreadsheet" : "CSV"}.` },
      { status: 400 }
    );
  }
  if (headers.length === 0) {
    return NextResponse.json(
      { error: "No column headers detected — first row must contain header names." },
      { status: 400 }
    );
  }

  const columns = inferCsvColumns(headers, rows);

  // Coerce values per inferred type so alasql can do real comparisons.
  const typedRows: Record<string, unknown>[] = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      const raw = r[col.name];
      out[col.name] = coerce(raw, col.type);
    }
    return out;
  });

  // Filename → friendly logical table name. Strip extension + non-word chars
  // so the AI can write `SELECT * FROM expenses` without quoting.
  const baseName = file.name
    .replace(/\.(csv|xlsx|xls)$/i, "")
    .replace(/[^a-zA-Z0-9_]+/g, "_") || "data";
  const tableName = baseName.toLowerCase();
  const displayName = nameInput || file.name.replace(/\.(csv|xlsx|xls)$/i, "");

  const config: CsvConfig = {
    tableName,
    columns,
    rows: typedRows,
    filename: file.name,
    rowCount: typedRows.length,
  };

  const conn = await prisma.sourceConnection.create({
    data: {
      workspaceId,
      kind: kindTag,
      name: displayName,
      status: "CONNECTED",
      // CSV / Excel data isn't a credential — store in plaintext config so
      // the connector can read it without decryption. Workspace-level ACL
      // (gateView/gateEdit) already gates who can read this row.
      config: config as unknown as Prisma.InputJsonValue,
      credentialsCipher: null,
      lastSyncAt: new Date(),
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        workspaceId,
        action: "connection.create",
        targetType: "source",
        targetId: conn.id,
        metadata: {
          kind: kindTag,
          name: conn.name,
          filename: file.name,
          rowCount: typedRows.length,
          columns: columns.map((c) => `${c.name}:${c.type}`),
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json(
    {
      connection: { id: conn.id, name: conn.name, kind: conn.kind, status: conn.status },
      probe: {
        rowCount: typedRows.length,
        columns: columns.length,
        tableName,
        sample: columns.map((c) => `${c.name}:${c.type}`).slice(0, 8).join(", "),
      },
    },
    { status: 201 }
  );
}

function coerce(v: unknown, type: CsvConfig["columns"][number]["type"]): unknown {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (s === "") return null;
  switch (type) {
    case "INT": {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }
    case "FLOAT": {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    }
    case "BOOL":
      return s === "true" || s === "TRUE";
    case "DATE":
      // alasql happily compares ISO-format strings. Keep as string for
      // BETWEEN '2026-01-01' AND '2026-12-31' style filters.
      return s;
    case "TEXT":
    default:
      return s;
  }
}
