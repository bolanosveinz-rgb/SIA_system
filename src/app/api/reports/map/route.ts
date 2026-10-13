import { NextResponse } from "next/server";
import { routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, lat: true, lng: true, status: true, createdAt: true },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    return routeError(error);
  }
}
