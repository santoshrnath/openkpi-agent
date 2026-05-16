import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";
import { makeConnector } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/workspaces/[slug]/connections/[id]/tables
 *
 * Returns the list of tables / datasets visible to the connection's
 * credentials. Per-kind implementation lives in each connector's
 * listTables() — Postgres uses pg_catalog, MSSQL / Snowflake use
 * INFORMATION_SCHEMA, BigQuery walks datasets via SDK, Power BI returns
 * 'workspace.dataset' pairs.
 *
 * Member-only (gateEdit) because the table list reveals schema.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;

  const conn = await prisma.sourceConnection.findFirst({
    where: { id: params.id, workspaceId: gate.workspaceId },
  });
  if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  try {
    const c = makeConnector(conn);
    const started = Date.now();
    const tables = await c.listTables();
    return NextResponse.json({
      tables,
      durationMs: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Could not list tables",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }
}
