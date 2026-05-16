import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/import/parse";
import { validateRows } from "@/lib/import/validate";
import { writeKpis } from "@/lib/import/write";
import { gateEdit } from "@/lib/acl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Accepts a CSV upload and creates / updates KPIs in the workspace.
 *
 * Request:
 *   - multipart/form-data with a `file` field (CSV)
 *     OR
 *   - text/csv body
 *
 * Response (200):
 *   { created, updated, names: string[], errors: RowError[], unmappedHeaders: string[] }
 *
 * Response (4xx): { error, detail? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // ── extract CSV text ────────────────────────────────────────────────────
  let csv = "";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing `file` field in form data" },
        { status: 400 }
      );
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 4MB). Split into chunks or contact us." },
        { status: 413 }
      );
    }
    csv = await file.text();
  } else if (ct.includes("text/csv") || ct.includes("text/plain")) {
    csv = await req.text();
  } else {
    return NextResponse.json(
      { error: "Send multipart form with `file` or text/csv body." },
      { status: 415 }
    );
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
  }

  // ── parse + validate ────────────────────────────────────────────────────
  const parsed = parseCsv(csv);
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error: "No data rows detected. Did your CSV have the expected headers?",
        headers: parsed.headers,
        unmappedHeaders: parsed.unmappedHeaders,
      },
      { status: 400 }
    );
  }

  const { records, errors } = validateRows(parsed.rows);

  // ── write (only valid records; errors surface in the response) ─────────
  const summary =
    records.length > 0 ? await writeKpis(ws.id, records) : { created: 0, updated: 0, names: [] };

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "kpi.import.csv",
        targetType: "workspace",
        targetId: ws.id,
        metadata: {
          totalRowsInCsv: parsed.rows.length,
          created: summary.created,
          updated: summary.updated,
          errors: errors.length,
          unmappedHeaders: parsed.unmappedHeaders,
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    workspace: { slug: ws.slug, name: ws.name },
    totalRows: parsed.rows.length,
    created: summary.created,
    updated: summary.updated,
    names: summary.names,
    errors,
    unmappedHeaders: parsed.unmappedHeaders,
    mapping: parsed.mapping,
  });
}
