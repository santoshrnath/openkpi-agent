import { notFound } from "next/navigation";
import { getKpisForWorkspace } from "@/lib/queries";
import { dbKpiToUi } from "@/lib/adapters";
import { ExplainerView } from "@/components/views/ExplainerView";

export const dynamic = "force-dynamic";

export default async function ExplainerPage({
  params,
}: {
  params: { slug: string };
}) {
  const ws = await getKpisForWorkspace(params.slug);
  if (!ws) notFound();
  return (
    <ExplainerView
      workspaceSlug={ws.slug}
      kpis={ws.kpis.map((k) => dbKpiToUi(k))}
    />
  );
}
