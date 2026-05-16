import { notFound } from "next/navigation";
import { getKpisForWorkspace } from "@/lib/queries";
import { dbKpiToUi } from "@/lib/adapters";
import { getWorkspaceAccess } from "@/lib/acl";
import { CatalogView } from "@/components/views/CatalogView";

export const dynamic = "force-dynamic";

export default async function WorkspaceCatalog({
  params,
}: {
  params: { slug: string };
}) {
  const ws = await getKpisForWorkspace(params.slug);
  if (!ws) notFound();
  const access = await getWorkspaceAccess(params.slug);
  return (
    <CatalogView
      workspaceSlug={ws.slug}
      kpis={ws.kpis.map((k) => dbKpiToUi(k))}
      canEdit={access?.canEdit}
    />
  );
}
