import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, setSessionCookie } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientAddress } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const client = getClientAddress(request.headers);
  if (!checkRateLimit(`admin-login:${client}`, 6)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please try again in 15 minutes." }, { status: 429 });
  }
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const user = await prisma.user.findUnique({ where: { email: parsed.data.identifier.toLowerCase() } });
    if (!user || user.role !== Role.ADMIN || !(await compare(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "The administrator email or password is incorrect." }, { status: 401 });
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
