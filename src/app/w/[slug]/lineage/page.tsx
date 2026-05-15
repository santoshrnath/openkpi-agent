import { notFound } from "next/navigation";
import { getWorkspaceBySlug, getLineageFlowsForWorkspace } from "@/lib/queries";
import { dbFlowToUi } from "@/lib/adapters";
import { LineageView } from "@/components/views/LineageView";

export const dynamic = "force-dynamic";

export default async function LineagePage({
  params,
}: {
  params: { slug: string };
}) {
  const ws = await getWorkspaceBySlug(params.slug);
  if (!ws) notFound();
  const flows = await getLineageFlowsForWorkspace(params.slug);
  return (
    <LineageView
      workspaceSlug={params.slug}
      flows={flows.map((f) => dbFlowToUi(f))}
    />
  );
}
