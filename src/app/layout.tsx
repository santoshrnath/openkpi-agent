import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: "OpenKPI Studio — AI-powered KPI intelligence",
  description:
    "Turn KPI confusion into trusted business intelligence. Document metrics, explain dashboard logic, trace lineage and generate executive insights with an AI-powered KPI workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
