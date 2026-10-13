import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

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
        { error: "The database is connected, but its ServeLink tables are missing or out of date. Run `npm run db:deploy` against this database, then restart the app." },
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
        { error: "DATABASE_URL is not a valid MySQL connection URL. Check its format in the app environment." },
        { status: 503 },
      );
    }
    if (code === "P1001" || code === "P1002" || code === "P1017") {
      return NextResponse.json(
        { error: "The app could not reach the database. Check the Railway public connection details and DATABASE_URL configured for the running app." },
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
