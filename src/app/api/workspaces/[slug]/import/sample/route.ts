import { NextResponse } from "next/server";
import { SAMPLE_CSV } from "@/lib/import/schema";

export const runtime = "nodejs";

export async function GET() {
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="openkpi-sample.csv"',
      "Cache-Control": "no-store",
    },
  });
}
