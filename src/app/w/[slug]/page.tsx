import { notFound } from "next/navigation";
import { getKpisForWorkspace } from "@/lib/queries";
import { dbKpiToUi } from "@/lib/adapters";
import { getViewer, getWorkspaceAccess } from "@/lib/acl";
import { CommandCenterView } from "@/components/views/CommandCenterView";

export const dynamic = "force-dynamic";

export default async function WorkspaceCommandCenter({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { readonly?: string };
}) {
  const ws = await getKpisForWorkspace(params.slug);
  if (!ws) notFound();

  const kpis = ws.kpis.map((k) => dbKpiToUi(k));
  const access = await getWorkspaceAccess(params.slug);
  const viewer = await getViewer();
  const isSignedIn = !!viewer.userId;

  return (
    <CommandCenterView
      workspaceSlug={ws.slug}
      workspaceName={ws.name}
      workspaceTagline={ws.tagline}
      kpis={kpis}
      canEdit={access?.canEdit}
      isSignedIn={isSignedIn}
      bouncedFrom={searchParams?.readonly}
    />
  );
}
