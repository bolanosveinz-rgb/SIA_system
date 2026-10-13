import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    const authorization = process.env.HEALTH_CHECK_TOKEN;
    if (authorization) {
      return NextResponse.json({ status: "ok" });
    }
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ready" });
  } catch (error) {
    console.error("Health check database probe failed:", error);
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
