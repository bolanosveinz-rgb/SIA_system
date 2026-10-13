import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(Role.RESIDENT);
  if (!user) return response;
  try {
    const after = request.nextUrl.searchParams.get("after");
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { report: { select: { id: true, title: true } } },
    });
    const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
    return NextResponse.json({ notifications, unread });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.RESIDENT);
  if (!user) return response;
  try {
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
