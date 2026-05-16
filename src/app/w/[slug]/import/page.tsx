import { notFound, redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/acl";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage({ params }: { params: { slug: string } }) {
  const access = await getWorkspaceAccess(params.slug);
  if (!access) notFound();
  if (!access.canEdit) {
    // Anon or signed-in-non-member of a PUBLIC workspace. Send them home with
    // a flag so the Command Center can explain why they were bounced.
    redirect(`/w/${params.slug}?readonly=import`);
  }
  return <ImportClient />;
}
