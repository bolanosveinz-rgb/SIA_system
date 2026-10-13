import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-errors";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const cloudinaryImageUrl = z.string().trim().url().max(2048).refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
});
const profilePhotoSchema = z.object({
  profilePhotoUrl: cloudinaryImageUrl.or(z.literal("")),
  profilePhotoPublicId: z.string().trim().max(255).or(z.literal("")),
}).refine(
  (photo) => Boolean(photo.profilePhotoUrl) === Boolean(photo.profilePhotoPublicId),
  { message: "Profile photo URL and asset ID must be provided together.", path: ["profilePhotoPublicId"] },
);

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.RESIDENT);
  if (!user) return response;

  try {
    const parsed = profilePhotoSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const previous = await prisma.residentProfile.findUnique({
      where: { userId: user.id },
      select: { profilePhotoPublicId: true },
    });
    const profile = await prisma.residentProfile.update({
      where: { userId: user.id },
      data: {
        profilePhotoUrl: parsed.data.profilePhotoUrl || null,
        profilePhotoPublicId: parsed.data.profilePhotoPublicId || null,
      },
      select: { profilePhotoUrl: true, profilePhotoPublicId: true },
    });

    if (previous?.profilePhotoPublicId && previous.profilePhotoPublicId !== profile.profilePhotoPublicId) {
      try {
        await deleteCloudinaryAsset(previous.profilePhotoPublicId, "image");
      } catch (error) {
        console.error("Could not remove replaced resident profile photo:", error);
      }
    }
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return databaseErrorResponse(error, "Resident profile update") ?? routeError(error);
  }
}
