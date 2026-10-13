import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { newsSchema } from "@/lib/validation";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";

type Context = { params: Promise<{ newsId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const { newsId } = await params;
    const parsed = newsSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const existing = await prisma.newsMedia.findMany({ where: { newsId } });
    const post = await prisma.news.update({
      where: { id: newsId },
      data: {
        caption: parsed.data.caption,
        media: {
          deleteMany: {},
          create: parsed.data.media,
        },
      },
      include: { media: true },
    });
    const retained = new Set(parsed.data.media.map((media) => media.publicId));
    const removed = existing.filter((media) => !retained.has(media.publicId));
    const cleanup = await Promise.allSettled(removed.map((media) => deleteCloudinaryAsset(media.publicId, media.type === "VIDEO" ? "video" : "image")));
    cleanup.forEach((result) => {
      if (result.status === "rejected") console.error("Could not remove replaced news media:", result.reason);
    });
    return NextResponse.json({ post });
  } catch (error) {
    return routeError(error, "This news post could not be updated.");
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const { newsId } = await params;
    const media = await prisma.newsMedia.findMany({ where: { newsId } });
    await prisma.news.delete({ where: { id: newsId } });
    const cleanup = await Promise.allSettled(media.map((item) => deleteCloudinaryAsset(item.publicId, item.type === "VIDEO" ? "video" : "image")));
    cleanup.forEach((result) => {
      if (result.status === "rejected") console.error("Could not remove deleted news media:", result.reason);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, "This news post could not be deleted.");
  }
}
