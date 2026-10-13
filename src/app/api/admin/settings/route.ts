import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, requireUser, setSessionCookie } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { z } from "zod";

const cloudinaryImageUrl = z.string().trim().url().max(2048).refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
});
const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  officeName: z.string().trim().min(2).max(160),
  contact: z.string().trim().max(80),
  address: z.string().trim().max(300),
  logoUrl: z.string().trim().url().max(2048).or(z.literal("")).optional(),
  profilePhotoUrl: cloudinaryImageUrl.or(z.literal("")).optional(),
  profilePhotoPublicId: z.string().trim().max(255).or(z.literal("")).optional(),
}).refine((profile) =>
  Boolean(profile.profilePhotoUrl) === Boolean(profile.profilePhotoPublicId),
  { message: "Profile photo URL and asset ID must be provided together.", path: ["profilePhotoPublicId"] },
);
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters.")
    .max(100)
    .refine((value) => new TextEncoder().encode(value).length <= 72, "Use a password no longer than 72 bytes."),
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
    const previous = await prisma.adminProfile.findUnique({
      where: { userId: user.id },
      select: { profilePhotoPublicId: true },
    });
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
              profilePhotoUrl: parsed.data.profilePhotoUrl || null,
              profilePhotoPublicId: parsed.data.profilePhotoPublicId || null,
            },
            update: {
              officeName: parsed.data.officeName,
              contact: parsed.data.contact,
              address: parsed.data.address,
              logoUrl: parsed.data.logoUrl || null,
              profilePhotoUrl: parsed.data.profilePhotoUrl || null,
              profilePhotoPublicId: parsed.data.profilePhotoPublicId || null,
            },
          },
        },
      },
      select: { name: true, email: true, adminProfile: true },
    });
    if (previous?.profilePhotoPublicId && previous.profilePhotoPublicId !== profile.adminProfile?.profilePhotoPublicId) {
      try {
        await deleteCloudinaryAsset(previous.profilePhotoPublicId, "image");
      } catch (error) {
        console.error("Could not remove replaced admin profile photo:", error);
      }
    }
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
