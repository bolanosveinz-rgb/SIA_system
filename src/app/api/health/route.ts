import { NextResponse } from "next/server";
import { databaseConfigurationError, databaseErrorResponse } from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = [!process.env.JWT_SECRET && "JWT_SECRET"].filter((value): value is string => Boolean(value));
  if (missing.length > 0) {
    return NextResponse.json({ status: "misconfigured", missing }, { status: 503 });
  }
  const databaseConfiguration = databaseConfigurationError();
  if (databaseConfiguration) {
    return NextResponse.json({ status: "misconfigured", error: databaseConfiguration }, { status: 503 });
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return NextResponse.json({ status: "misconfigured", invalid: ["JWT_SECRET"] }, { status: 503 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ready" });
  } catch (error) {
    const databaseResponse = databaseErrorResponse(error, "Health check");
    if (databaseResponse) {
      return NextResponse.json({ status: "unavailable", error: (await databaseResponse.json()).error }, { status: 503 });
    }
    console.error("Health check database probe failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
