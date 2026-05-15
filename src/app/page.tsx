import { redirect } from "next/navigation";

export default function RootRedirect() {
  // The product is workspace-scoped. The seeded sample workspace at /w/demo
  // is the public landing experience.
  redirect("/w/demo");
}
