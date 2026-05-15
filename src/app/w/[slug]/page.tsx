import { notFound } from "next/navigation";
import { getKpisForWorkspace } from "@/lib/queries";
import { dbKpiToUi } from "@/lib/adapters";
import { CommandCenterView } from "@/components/views/CommandCenterView";

export const dynamic = "force-dynamic";

export default async function WorkspaceCommandCenter({
  params,
}: {
  params: { slug: string };
}) {
  const ws = await getKpisForWorkspace(params.slug);
  if (!ws) notFound();

  const kpis = ws.kpis.map((k) => dbKpiToUi(k));

  return (
    <CommandCenterView
      workspaceSlug={ws.slug}
      workspaceName={ws.name}
      workspaceTagline={ws.tagline}
      kpis={kpis}
    />
  );
}
