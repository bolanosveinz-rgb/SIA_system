import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, setSessionCookie } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`login:${client}`, 8)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please try again in 15 minutes." }, { status: 429 });
  }

  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const identifier = parsed.data.identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { residentProfile: { phone: parsed.data.identifier } }],
      },
    });
    if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "The email/phone or password is incorrect." }, { status: 401 });
    }
    if (user.role !== Role.RESIDENT) {
      return NextResponse.json({ error: "Use the LGU administrator sign-in page." }, { status: 403 });
    }
    const session = { id: user.id, name: user.name, email: user.email, role: user.role };
    const response = NextResponse.json({ user: session });
    await setSessionCookie(response, session);
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return routeError(error);
  }
}
