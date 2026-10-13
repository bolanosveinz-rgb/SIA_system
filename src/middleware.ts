import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "servelink_session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  const route = request.nextUrl.pathname;
  const adminPage = route.startsWith("/admin");
  const adminApi = route.startsWith("/api/admin");
  const authPage = route === "/login" || route === "/register" || route === "/admin/login";

  if (!token) {
    if (adminApi) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (adminPage && route !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (authPage) return NextResponse.next();
    return NextResponse.next();
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const isAdmin = payload.role === "ADMIN";
    if ((adminPage || adminApi) && !isAdmin) {
      if (adminApi) return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (route === "/admin/login" && isAdmin) return NextResponse.redirect(new URL("/admin", request.url));
    if (authPage && !adminPage && isAdmin) return NextResponse.redirect(new URL("/admin", request.url));
    if ((route === "/login" || route === "/register") && payload.role === "RESIDENT") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  } catch (error) {
    console.error("Protected-route session verification failed:", error);
    const response = adminApi
      ? NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 })
      : NextResponse.redirect(new URL(adminPage ? "/admin/login" : "/login", request.url));
    response.cookies.delete(COOKIE);
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/login", "/register", "/admin/login"],
};
