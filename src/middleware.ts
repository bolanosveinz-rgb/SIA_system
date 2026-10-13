import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const COOKIE = "servelink_session";

function loginRedirect(request: NextRequest, returnTo: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  const route = request.nextUrl.pathname;
  const adminPage = route.startsWith("/admin");
  const adminApi = route.startsWith("/api/admin");
  const residentPage = ["/map", "/my-reports", "/profile"].some((path) => route === path || route.startsWith(`${path}/`));
  const residentOnlyPage = ["/my-reports", "/profile"].some((path) => route === path || route.startsWith(`${path}/`));
  const aiApi = route === "/api/ai";
  const authPage = route === "/login" || route === "/register" || route === "/admin/login";

  if (!token) {
    if (adminApi) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (aiApi) return NextResponse.json({ error: "Please sign in to use the community assistant." }, { status: 401 });
    if (adminPage && route !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (residentPage) return loginRedirect(request, `${route}${request.nextUrl.search}`);
    if (authPage) return NextResponse.next();
    return NextResponse.next();
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    const isAdmin = payload.role === "ADMIN";
    const isResident = payload.role === "RESIDENT";
    if (aiApi && !isAdmin && !isResident) {
      return NextResponse.json({ error: "You do not have permission to use the community assistant." }, { status: 403 });
    }
    if ((adminPage || adminApi) && !isAdmin) {
      if (adminApi) return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (residentOnlyPage && !isResident) return NextResponse.redirect(new URL("/admin", request.url));
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
      : adminPage
        ? NextResponse.redirect(new URL("/admin/login", request.url))
        : aiApi
          ? NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 })
          : residentPage
            ? loginRedirect(request, `${route}${request.nextUrl.search}`)
            : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(COOKIE);
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/ai", "/map/:path*", "/my-reports/:path*", "/profile/:path*", "/login", "/register", "/admin/login"],
};
