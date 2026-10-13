import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Role, type User } from "@prisma/client";

export const SESSION_COOKIE = "servelink_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = Pick<User, "id" | "name" | "email" | "role">;

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function setSessionCookie(response: NextResponse, user: SessionUser) {
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      (payload.role !== Role.ADMIN && payload.role !== Role.RESIDENT)
    ) {
      return null;
    }
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    if (error instanceof Error && error.name !== "JWTExpired") {
      console.error("Session token verification failed:", error.message);
    }
    return null;
  }
}

export async function requireUser(role?: Role) {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  }
  if (role && user.role !== role) {
    return { user: null, response: NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 }) };
  }
  return { user, response: null };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const requestUrl = new URL(request.url);
    const expectedHost = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
    const expectedProtocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, "")}:` : requestUrl.protocol;
    const trustedOrigin = new URL(`${expectedProtocol}//${expectedHost}`);
    const receivedOrigin = new URL(origin);
    return receivedOrigin.origin === trustedOrigin.origin;
  } catch {
    return false;
  }
}
