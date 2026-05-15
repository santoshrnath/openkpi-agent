import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/queries";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const ws = await getWorkspaceBySlug(params.slug);
  if (!ws) notFound();
  return <>{children}</>;
}
