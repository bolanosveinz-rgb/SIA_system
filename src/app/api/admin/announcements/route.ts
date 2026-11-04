import { NextRequest, NextResponse } from "next/server";
import { NotificationType, Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { announcementSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const parsed = announcementSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const residents = await prisma.user.findMany({ where: { role: Role.RESIDENT }, select: { id: true } });
    if (!residents.length) return NextResponse.json({ error: "There are no resident accounts to receive this announcement." }, { status: 409 });
    const result = await prisma.notification.createMany({
      data: residents.map(({ id }) => ({
        userId: id,
        type: NotificationType.ANNOUNCEMENT,
        message: `Community announcement: ${parsed.data.message}`,
      })),
    });
    return NextResponse.json({ recipients: result.count }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return routeError(error, "The announcement could not be sent.");
  }
}
