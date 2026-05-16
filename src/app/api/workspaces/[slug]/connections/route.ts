import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { PostgresConnector } from "@/lib/connectors/postgres";
import { SnowflakeConnector } from "@/lib/connectors/snowflake";
import { MssqlConnector } from "@/lib/connectors/mssql";
import { BigQueryConnector } from "@/lib/connectors/bigquery";
import { PowerBIConnector } from "@/lib/connectors/powerbi";
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
