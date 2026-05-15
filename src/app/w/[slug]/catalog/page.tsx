import { notFound } from "next/navigation";
import { getKpisForWorkspace } from "@/lib/queries";
import { dbKpiToUi } from "@/lib/adapters";
import { CatalogView } from "@/components/views/CatalogView";

export const dynamic = "force-dynamic";

export default async function WorkspaceCatalog({
  params,
}: {
  params: { slug: string };
}) {
  const ws = await getKpisForWorkspace(params.slug);
  if (!ws) notFound();
  return (
    <CatalogView
      workspaceSlug={ws.slug}
      kpis={ws.kpis.map((k) => dbKpiToUi(k))}
    />
  );
}
