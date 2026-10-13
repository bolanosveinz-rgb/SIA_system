import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { newsSchema } from "@/lib/validation";

type Context = { params: Promise<{ newsId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const { newsId } = await params;
    const parsed = newsSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
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
    await prisma.news.delete({ where: { id: newsId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, "This news post could not be deleted.");
  }
}
