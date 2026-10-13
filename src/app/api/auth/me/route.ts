import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  if (user.role === "RESIDENT") {
    const profile = await prisma.residentProfile.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ user: { ...user, profile } });
  }
  const profile = await prisma.adminProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ user: { ...user, profile } });
}
