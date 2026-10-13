import { NextRequest, NextResponse } from "next/server";
import { NotificationType, ReportStatus, Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Context = { params: Promise<{ reportId: string }> };
const updateSchema = z.object({
  status: z.nativeEnum(ReportStatus),
  remarks: z.string().trim().max(5000).optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const { reportId } = await params;
    const report = await prisma.report.update({
      where: { id: reportId },
      data: { status: parsed.data.status, remarks: parsed.data.remarks ?? null },
      include: { resident: { select: { name: true } } },
    });
    await prisma.notification.create({
      data: {
        userId: report.residentId,
        reportId: report.id,
        type: NotificationType.REPORT_UPDATED,
        message: `Your report "${report.title}" is now ${report.status.replace("_", " ").toLowerCase()}.`,
      },
    });
    return NextResponse.json({ report });
  } catch (error) {
    return routeError(error, "This report could not be updated.");
  }
}
