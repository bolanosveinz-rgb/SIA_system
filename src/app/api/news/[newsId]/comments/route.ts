import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionUser, isSameOrigin, requireUser } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Context = { params: Promise<{ newsId: string }> };
const commentSchema = z.object({ body: z.string().trim().min(1, "Write a comment first.").max(2000) });

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { newsId } = await params;
    const viewer = await getSessionUser();
    const post = await prisma.news.findFirst({
      where: { id: newsId, ...(viewer?.role === Role.ADMIN ? {} : { published: true }) },
      select: { id: true },
    });
    if (!post) return NextResponse.json({ error: "This news post was not found." }, { status: 404 });
    const comments = await prisma.comment.findMany({
      where: { newsId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, residentProfile: { select: { profilePhotoUrl: true } } } } },
    });
    return NextResponse.json({ comments });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.RESIDENT);
  if (!user) return response;
  try {
    const parsed = commentSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const { newsId } = await params;
    const post = await prisma.news.findFirst({ where: { id: newsId, published: true }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "This news post is no longer available." }, { status: 404 });
    const comment = await prisma.comment.create({
      data: { newsId, userId: user.id, body: parsed.data.body },
      include: { user: { select: { name: true, residentProfile: { select: { profilePhotoUrl: true } } } } },
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return routeError(error, "This comment could not be posted.");
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getSessionUser();
  if (!user || user.role !== Role.ADMIN) return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  const commentId = request.nextUrl.searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "A comment ID is required." }, { status: 400 });
  try {
    const { newsId } = await params;
    await prisma.comment.delete({ where: { id: commentId, newsId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, "This comment could not be deleted.");
  }
}
