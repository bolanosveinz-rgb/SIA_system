import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const { userId } = await params;
    const resident = await prisma.user.findFirst({
      where: { id: userId, role: Role.RESIDENT },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        residentProfile: true,
        reports: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!resident) return NextResponse.json({ error: "Resident account not found." }, { status: 404 });
    return NextResponse.json({ resident });
  } catch (error) {
    return routeError(error);
  }
}
