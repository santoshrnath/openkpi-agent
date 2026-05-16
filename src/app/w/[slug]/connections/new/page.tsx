import { notFound, redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/acl";
import NewConnectionClient from "./NewConnectionClient";

export const dynamic = "force-dynamic";

export default async function NewConnectionPage({ params }: { params: { slug: string } }) {
  const access = await getWorkspaceAccess(params.slug);
  if (!access) notFound();
  if (!access.canEdit) {
    redirect(`/w/${params.slug}?readonly=connection`);
  }
  return <NewConnectionClient />;
}
