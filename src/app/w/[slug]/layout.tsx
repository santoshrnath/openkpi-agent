import { notFound, redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/acl";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const access = await getWorkspaceAccess(params.slug);
  if (!access) notFound();
  if (!access.canView) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/w/${params.slug}`)}`);
  }
  return <>{children}</>;
}
