import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "rgb(99, 102, 241)",
          borderRadius: "10px",
        },
      }}
    >
      <html lang="en">
        <body>
          <Shell>{children}</Shell>
        </body>
      </html>
    </ClerkProvider>
  );
}
