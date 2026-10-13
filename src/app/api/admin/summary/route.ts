import { NextResponse } from "next/server";
import { ReportStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const [residents, reports, pending, resolved, unread, recentReports] = await Promise.all([
      prisma.user.count({ where: { role: Role.RESIDENT } }),
      prisma.report.count(),
      prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { resident: { select: { name: true } } },
      }),
    ]);
    return NextResponse.json({ stats: { residents, reports, pending, resolved, unread }, recentReports });
  } catch (error) {
    return routeError(error);
  }
}
