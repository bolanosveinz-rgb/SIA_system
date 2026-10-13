import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const take = 12;
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  try {
    const where = {
      role: Role.RESIDENT,
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { residentProfile: { phone: { contains: search } } },
          { residentProfile: { barangay: { contains: search } } },
        ],
      } : {}),
    };
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * take,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, createdAt: true, residentProfile: true, _count: { select: { reports: true } } },
      }),
    ]);
    return NextResponse.json({ users, page, pages: Math.max(1, Math.ceil(total / take)), total });
  } catch (error) {
    return routeError(error);
  }
}
