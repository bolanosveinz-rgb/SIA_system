import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, requireUser, setSessionCookie } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  officeName: z.string().trim().min(2).max(160),
  contact: z.string().trim().max(80),
  address: z.string().trim().max(300),
  logoUrl: z.string().trim().url().max(2048).or(z.literal("")).optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export async function GET() {
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, adminProfile: true },
    });
    const response = NextResponse.json({ profile });
    await setSessionCookie(response, { id: user.id, name: profile?.name ?? user.name, email: profile?.email ?? user.email, role: Role.ADMIN });
    return response;
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const existing = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: user.id } }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
    const profile = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        adminProfile: {
          upsert: {
            create: {
              officeName: parsed.data.officeName,
              contact: parsed.data.contact,
              address: parsed.data.address,
              logoUrl: parsed.data.logoUrl || null,
            },
            update: {
              officeName: parsed.data.officeName,
              contact: parsed.data.contact,
              address: parsed.data.address,
              logoUrl: parsed.data.logoUrl || null,
            },
          },
        },
      },
      select: { name: true, email: true, adminProfile: true },
    });
    const response = NextResponse.json({ profile });
    await setSessionCookie(response, { id: user.id, name: profile.name, email: profile.email, role: Role.ADMIN });
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const parsed = passwordSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!record || !(await compare(parsed.data.currentPassword, record.passwordHash))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(parsed.data.newPassword, 12) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return routeError(error);
  }
}
