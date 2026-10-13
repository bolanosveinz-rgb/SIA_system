import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ready" });
  } catch (error) {
    console.error("Health check database probe failed:", error);
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
