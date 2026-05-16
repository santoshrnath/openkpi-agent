import { notFound } from "next/navigation";
import { getKpiBySlug } from "@/lib/queries";
import { dbKpiToUi } from "@/lib/adapters";
import { generateMockAIResponse } from "@/lib/mockAI";
import { KpiDetailView } from "@/components/views/KpiDetailView";

export const dynamic = "force-dynamic";

export default async function KpiDetail({
  params,
}: {
  params: { slug: string; kpiSlug: string };
}) {
  const dbKpi = await getKpiBySlug(params.slug, params.kpiSlug);
  if (!dbKpi) notFound();
  const kpi = dbKpiToUi(dbKpi);
  // Quick definition hint for the AI rail. The full agent lives at /explainer.
  const aiHint = generateMockAIResponse(`What does ${kpi.name} mean?`, kpi).answer;
  const isLive = !!dbKpi.connectionId;
  return (
    <KpiDetailView
      workspaceSlug={params.slug}
      kpi={kpi}
      aiHint={aiHint}
      isLive={isLive}
    />
  );
}
