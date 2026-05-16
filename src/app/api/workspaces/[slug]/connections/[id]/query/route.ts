import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeConnector } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({
  sql: z.string().min(1).max(20_000),
  rowLimit: z.number().int().min(1).max(5000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const conn = await prisma.sourceConnection.findFirst({
    where: { id: params.id, workspaceId: ws.id },
  });
  if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  // Defensive guard: refuse obvious mutations even though the connector wraps
  // everything in a read-only transaction.
  if (/\b(insert|update|delete|drop|truncate|alter|grant|revoke|create)\b/i.test(body.sql)) {
    return NextResponse.json(
      {
        error:
          "Only read-only SELECT queries are allowed. Mutations are blocked at the connector and the API layer.",
      },
      { status: 400 }
    );
  }

  try {
    const c = makeConnector(conn);
    const result = await c.query(body.sql, { rowLimit: body.rowLimit ?? 50 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Query failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
