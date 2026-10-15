import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export function databaseConfigurationError(
  databaseUrl = process.env.DATABASE_URL,
  directUrl = process.env.DIRECT_URL,
) {
  for (const [name, value] of [["DATABASE_URL", databaseUrl], ["DIRECT_URL", directUrl]] as const) {
    if (!value) {
      return `${name} is not configured. Set DATABASE_URL to the Supabase PostgreSQL transaction pooler URL and DIRECT_URL to the session pooler URL.`;
    }
    try {
      const url = new URL(value);
      if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        return `${name} must use a PostgreSQL URL. This app uses Prisma with Supabase PostgreSQL, not MySQL.`;
      }
      if (!url.hostname || url.pathname === "/" || url.pathname.length < 2) {
        return `${name} is not a complete PostgreSQL connection URL. Use the database connection URL from Supabase.`;
      }
    } catch {
      return `${name} is not a valid PostgreSQL connection URL. Check its format in the app environment.`;
    }
  }
  return null;
}

export function databaseErrorResponse(error: unknown, operation: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`${operation} database request failed:`, error.code);
    if (error.code === "P2002") {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(" ").toLowerCase() : String(target ?? "").toLowerCase();
      if (fields.includes("phone")) {
        return NextResponse.json({ error: "An account with this phone number already exists." }, { status: 409 });
      }
      if (fields.includes("email")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: "This account information is already in use." }, { status: 409 });
    }
    if (error.code === "P2021" || error.code === "P2022") {
      return NextResponse.json(
        { error: "The database is connected, but the ServeLink tables in the public schema are missing or out of date. Supabase storage tables such as storage.objects are unrelated. Configure DATABASE_URL and DIRECT_URL, then run `npm run db:deploy` against this database." },
        { status: 503 },
      );
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    const code = error.errorCode ?? "unknown";
    console.error(`${operation} database initialization failed:`, code);
    if (code === "P1000" || code === "P1010") {
      return NextResponse.json(
        { error: "The database rejected its credentials. Check the DATABASE_URL configured for the running app." },
        { status: 503 },
      );
    }
    if (code === "P1003") {
      return NextResponse.json(
        { error: "The database named in DATABASE_URL does not exist. Verify the database name in the app environment." },
        { status: 503 },
      );
    }
    if (code === "P1013") {
      return NextResponse.json(
        { error: "DATABASE_URL is not a valid PostgreSQL connection URL. Check its format in the app environment." },
        { status: 503 },
      );
    }
    if (code === "P1001" || code === "P1002" || code === "P1017") {
      return NextResponse.json(
        { error: "The app could not reach the database. Check the Supabase connection details and DATABASE_URL configured for the running app." },
        { status: 503 },
      );
    }
    console.error(`${operation} database connection could not be initialized.`);
    return NextResponse.json(
      { error: "The app could not initialize its database connection. Check DATABASE_URL in the running app's environment." },
      { status: 503 },
    );
  }

  return null;
}
