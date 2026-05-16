import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { PostgresConnector } from "@/lib/connectors/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ─── GET — list connections (without credentials) ────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
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
  kind: z.literal("POSTGRES"), // expand as we add connectors
  name: z.string().min(1).max(80),
  url: z
    .string()
    .min(20)
    .max(2000)
    .refine((s) => /^postgres(ql)?:\/\//.test(s), "Must be a postgres:// URL"),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  // Test the connection BEFORE persisting the credentials.
  const probe = await new PostgresConnector({ url: body.url }).test();
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
      credentialsCipher: encryptJson({ url: body.url }),
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
