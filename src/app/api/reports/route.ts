import { NextRequest, NextResponse } from "next/server";
import { NotificationType, ReportStatus, Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const query = request.nextUrl.searchParams;
    const status = query.get("status");
    if (status && status !== "ALL" && !Object.values(ReportStatus).includes(status as ReportStatus)) {
      return NextResponse.json({ error: "Choose a valid report status." }, { status: 400 });
    }
    const from = query.get("from");
    const to = query.get("to");
    const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined;
    if ((fromDate && !Number.isFinite(fromDate.getTime())) || (toDate && !Number.isFinite(toDate.getTime()))) {
      return NextResponse.json({ error: "Choose valid date filters." }, { status: 400 });
    }
    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json({ error: "The start date must be on or before the end date." }, { status: 400 });
    }
    const createdAt = fromDate || toDate ? {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    } : undefined;
    const where = user.role === Role.ADMIN
      ? {
          ...(status && status !== "ALL" ? { status: status as ReportStatus } : {}),
          ...(query.get("barangay") && query.get("barangay") !== "ALL" ? { barangay: query.get("barangay")! } : {}),
          ...(createdAt ? { createdAt } : {}),
          ...(query.get("search") ? {
            OR: [
              { title: { contains: query.get("search")! } },
              { description: { contains: query.get("search")! } },
              { resident: { name: { contains: query.get("search")! } } },
            ],
          } : {}),
        }
      : { residentId: user.id };
    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { resident: { select: { id: true, name: true, email: true, residentProfile: true } } },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.RESIDENT);
  if (!user) return response;
  try {
    const parsed = reportSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true } });
    const report = await prisma.$transaction(async (transaction) => {
      const created = await transaction.report.create({
        data: {
          ...parsed.data,
          residentId: user.id,
          status: ReportStatus.PENDING,
        },
      });
      if (admins.length > 0) {
        await transaction.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            reportId: created.id,
            type: NotificationType.NEW_REPORT,
            message: `${user.name} submitted a new report: ${created.title}`,
          })),
        });
      }
      return created;
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return routeError(error);
  }
}
