import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeConnector } from "@/lib/connectors";
import { gateEdit } from "@/lib/acl";
import { ConnectorKind } from "@/lib/connectors/types";
import { getSchemaSnapshot } from "@/lib/connectors/schema";
import { draftSqlFromQuestion, validateReadOnlySql } from "@/lib/ai/nlsql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  question: z.string().min(2).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional(),
});

/**
 * POST /api/workspaces/[slug]/connections/[id]/ask
 *
 * Natural-language → SQL → executed result. The flow:
 *   1. ACL gate (gateEdit — schema is sensitive)
 *   2. Snapshot the connection's schema (cached implicitly per request)
 *   3. Ask Claude to draft one SELECT against that schema
 *   4. Validate it's read-only (defense in depth — connector wraps in RO txn)
 *   5. Execute via existing connector path
 *   6. Return { sql, explanation, columns, rows, durationMs, model }
 *
 * Member-only (gateEdit). Costs an Anthropic call per invocation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;

  const conn = await prisma.sourceConnection.findFirst({
    where: { id: params.id, workspaceId: gate.workspaceId },
  });
  if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  const started = Date.now();
  let draft;
  try {
    const c = makeConnector(conn);
    const snap = await getSchemaSnapshot(c, conn.kind as ConnectorKind, conn.config);
    if (snap.tables.length === 0) {
      return NextResponse.json(
        { error: "No tables visible to this connection — cannot ground the answer." },
        { status: 422 }
      );
    }
    draft = await draftSqlFromQuestion(body.question, snap, body.history ?? []);
  } catch (e) {
    return NextResponse.json(
      { error: "AI drafting failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  if (!draft.sql) {
    return NextResponse.json({
      sql: "",
      explanation: draft.explanation || "I couldn't form a SQL query for that question.",
      columns: [],
      rows: [],
      truncated: false,
      durationMs: Date.now() - started,
      model: draft.model,
    });
  }

  const violation = validateReadOnlySql(draft.sql);
  if (violation) {
    return NextResponse.json(
      {
        sql: draft.sql,
        explanation: draft.explanation,
        error: violation,
        columns: [],
        rows: [],
        durationMs: Date.now() - started,
        model: draft.model,
      },
      { status: 400 }
    );
  }

  try {
    const c = makeConnector(conn);
    const result = await c.query(draft.sql, { rowLimit: 200, timeoutMs: 15_000 });
    return NextResponse.json({
      sql: draft.sql,
      explanation: draft.explanation,
      columns: result.columns,
      rows: result.rows,
      truncated: result.truncated,
      queryMs: result.durationMs,
      durationMs: Date.now() - started,
      model: draft.model,
      usage: draft.usage,
    });
  } catch (e) {
    return NextResponse.json(
      {
        sql: draft.sql,
        explanation: draft.explanation,
        error: "Generated SQL failed to execute",
        detail: e instanceof Error ? e.message : String(e),
        columns: [],
        rows: [],
        durationMs: Date.now() - started,
        model: draft.model,
      },
      { status: 502 }
    );
  }
}
