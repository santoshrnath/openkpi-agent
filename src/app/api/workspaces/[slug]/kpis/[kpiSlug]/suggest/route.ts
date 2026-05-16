import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { KpiDomain } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gateEdit } from "@/lib/acl";
import { suggestKpiDocs } from "@/lib/ai/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({
  /** Which fields to fill. If empty, only blank fields are filled. */
  fields: z
    .array(z.enum(["definition", "formula", "limitations", "domain", "owner", "sourceSystem", "refreshFrequency", "goodWhenUp"]))
    .optional(),
  /** If true, fields already filled are also rewritten. Default false. */
  overwrite: z.boolean().optional(),
  /** If true, return the suggestion without persisting. */
  preview: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; kpiSlug: string } }
) {
  const gate = await gateEdit(params.slug);
  if (gate instanceof NextResponse) return gate;

  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const kpi = await prisma.kpi.findUnique({
    where: { workspaceId_slug: { workspaceId: ws.id, slug: params.kpiSlug } },
  });
  if (!kpi) return NextResponse.json({ error: "KPI not found" }, { status: 404 });

  let body: z.infer<typeof Body> = {};
  try {
    body = Body.parse(await req.json().catch(() => ({})));
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  let suggestion;
  try {
    suggestion = await suggestKpiDocs({
      name: kpi.name,
      value: kpi.value,
      previousValue: kpi.previousValue,
      unit: kpi.unit,
      workspaceName: ws.name,
      existing: {
        definition: kpi.definition || undefined,
        formula: kpi.formula || undefined,
        limitations: kpi.limitations || undefined,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "AI suggestion failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  if (body.preview) {
    return NextResponse.json({ suggestion });
  }

  // Persist only the fields that the user asked for (or — by default — any blank ones).
  const overwrite = body.overwrite === true;
  const requested = new Set(body.fields ?? [
    "definition", "formula", "limitations", "domain",
    "owner", "sourceSystem", "refreshFrequency", "goodWhenUp",
  ]);
  const fillIfBlank = (key: string, current: string | null | undefined): boolean =>
    requested.has(key) && (overwrite || !current?.trim());

  const data: Record<string, unknown> = {};
  if (fillIfBlank("definition", kpi.definition)) data.definition = suggestion.definition;
  if (fillIfBlank("formula", kpi.formula)) data.formula = suggestion.formula;
  if (fillIfBlank("limitations", kpi.limitations)) data.limitations = suggestion.limitations;
  if (requested.has("domain") && (overwrite || kpi.domain === KpiDomain.CUSTOM))
    data.domain = suggestion.domain as KpiDomain;
  if (fillIfBlank("owner", kpi.owner === "Unassigned" ? "" : kpi.owner))
    data.owner = suggestion.ownerHint;
  if (fillIfBlank("sourceSystem", kpi.sourceSystem === "Unknown" ? "" : kpi.sourceSystem))
    data.sourceSystem = suggestion.sourceSystemHint;
  if (fillIfBlank("refreshFrequency", kpi.refreshFrequency === "Monthly" && overwrite ? "" : kpi.refreshFrequency))
    data.refreshFrequency = suggestion.refreshFrequencyHint;
  if (requested.has("goodWhenUp") && overwrite) data.goodWhenUp = suggestion.goodWhenUp;

  if (Object.keys(data).length > 0) {
    await prisma.kpi.update({ where: { id: kpi.id }, data });
  }

  await prisma.auditEvent
    .create({
      data: {
        workspaceId: ws.id,
        action: "kpi.suggest",
        targetType: "kpi",
        targetId: kpi.id,
        metadata: {
          updatedFields: Object.keys(data),
          model: suggestion.model,
          inputTokens: suggestion.usage.input,
          outputTokens: suggestion.usage.output,
          confidenceHint: suggestion.confidenceHint,
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    updated: Object.keys(data),
    suggestion,
  });
}
