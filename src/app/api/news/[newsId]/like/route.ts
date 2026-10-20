import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ newsId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.RESIDENT);
  if (!user) return response;
  try {
    const { newsId } = await params;
    const post = await prisma.news.findFirst({
      where: { id: newsId, published: true },
      select: { id: true },
    });
    if (!post) return NextResponse.json({ error: "This news post is no longer available." }, { status: 404 });
    const existing = await prisma.like.findUnique({ where: { userId_newsId: { userId: user.id, newsId } } });
    if (existing) await prisma.like.delete({ where: { id: existing.id } });
    else {
      await prisma.like.create({ data: { userId: user.id, newsId } });
    }
    return NextResponse.json({ liked: !existing });
  } catch (error) {
    return routeError(error, "This news post could not be liked.");
  }
}
