import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { hasValidSessionSecret, setSessionCookie } from "@/lib/auth";
import { validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientAddress } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { databaseConfigurationError, databaseErrorResponse } from "@/lib/database-errors";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const client = getClientAddress(request.headers);
  if (!checkRateLimit(`register:${client}`, 5)) {
    return NextResponse.json({ error: "Too many sign-up attempts. Please try again in 15 minutes." }, { status: 429 });
  }
  if (!hasValidSessionSecret()) {
    console.error("Resident registration unavailable: JWT_SECRET is missing or shorter than 32 characters.");
    return NextResponse.json(
      { error: "Account registration is not configured correctly. Set a JWT_SECRET of at least 32 characters in the app environment, then restart the app." },
      { status: 503 },
    );
  }
  const databaseConfiguration = databaseConfigurationError();
  if (databaseConfiguration) {
    console.error("Resident registration unavailable:", databaseConfiguration);
    return NextResponse.json({ error: databaseConfiguration }, { status: 503 });
  }

  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.email === (process.env.ADMIN_EMAIL ?? "admin@tupi.gov.ph").trim().toLowerCase()) {
      return NextResponse.json({ error: "This email address is reserved for LGU administration." }, { status: 409 });
    }
    const [existingEmail, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
      prisma.residentProfile.findUnique({ where: { phone: parsed.data.phone }, select: { id: true } }),
    ]);
    if (existingEmail) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    if (existingPhone) return NextResponse.json({ error: "An account with this phone number already exists." }, { status: 409 });
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hash(parsed.data.password, 12),
        role: Role.RESIDENT,
        residentProfile: {
          create: {
            phone: parsed.data.phone,
            barangay: parsed.data.barangay,
            address: parsed.data.address,
          },
        },
      },
      select: { id: true, name: true, email: true, role: true },
    });
    const response = NextResponse.json({ user }, { status: 201 });
    await setSessionCookie(response, user);
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    const databaseResponse = databaseErrorResponse(error, "Resident registration");
    if (databaseResponse) return databaseResponse;
    console.error("Resident registration failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Account registration could not be completed. Check the app's server logs for the registration error." }, { status: 500 });
  }
}
