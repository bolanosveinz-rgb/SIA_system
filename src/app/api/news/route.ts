import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionUser, isSameOrigin, requireUser } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { newsSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await getSessionUser();
    const posts = await prisma.news.findMany({
      where: user?.role === Role.ADMIN ? {} : { published: true },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { name: true } },
        media: { orderBy: { createdAt: "asc" } },
        _count: { select: { likes: true, comments: true } },
        ...(user ? { likes: { where: { userId: user.id }, select: { id: true } } } : {}),
      },
    });
    return NextResponse.json({ posts: posts.map((post) => ({ ...post, liked: "likes" in post ? post.likes.length > 0 : false })) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser(Role.ADMIN);
  if (!user) return response;
  try {
    const parsed = newsSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const post = await prisma.news.create({
      data: {
        caption: parsed.data.caption,
        authorId: user.id,
        media: { create: parsed.data.media },
      },
      include: { media: true },
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return routeError(error);
  }
}
