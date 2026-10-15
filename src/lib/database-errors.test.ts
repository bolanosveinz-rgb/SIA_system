import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { databaseConfigurationError, databaseErrorResponse } from "@/lib/database-errors";

function prismaError(code: string, target?: string[]) {
  return new Prisma.PrismaClientKnownRequestError("Database request failed", {
    code,
    clientVersion: "test",
    meta: target ? { target } : undefined,
  });
}

test("explains that database tables need a migration without exposing SQL details", async () => {
  const response = databaseErrorResponse(prismaError("P2021"), "Test");
  assert.ok(response);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /npm run db:deploy/);
  assert.match(body.error, /storage\.objects are unrelated/);
});

test("rejects MySQL configuration without exposing connection details", () => {
  const error = databaseConfigurationError(
    "mysql://private-user:private-password@private-host:3306/app",
    "postgresql://user:secret@pooler.example:5432/postgres",
  );
  assert.match(error ?? "", /must use a PostgreSQL URL/);
  assert.doesNotMatch(error ?? "", /private-user|private-password|private-host/);
});

test("requires both Supabase PostgreSQL URLs", () => {
  assert.match(
    databaseConfigurationError("postgresql://user:secret@pooler.example:6543/postgres?pgbouncer=true", "") ?? "",
    /DIRECT_URL is not configured/,
  );
});

test("accepts configured PostgreSQL URLs", () => {
  assert.equal(
    databaseConfigurationError(
      "postgresql://user:secret@pooler.example:6543/postgres?pgbouncer=true",
      "postgresql://user:secret@pooler.example:5432/postgres",
    ),
    null,
  );
});

test("maps duplicate resident phone numbers to a friendly conflict", async () => {
  const response = databaseErrorResponse(prismaError("P2002", ["phone"]), "Test");
  assert.ok(response);
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /phone number already exists/);
});

test("does not expose database connection details in credential failures", async () => {
  const error = new Prisma.PrismaClientInitializationError(
    "Access denied for user `root` at `db.example:3306`",
    "test",
    "P1000",
  );
  const response = databaseErrorResponse(error, "Test");
  assert.ok(response);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /DATABASE_URL/);
  assert.doesNotMatch(body.error, /root|db\.example|3306/);
});

test("leaves unrelated exceptions for the caller to handle", () => {
  assert.equal(databaseErrorResponse(new Error("unexpected"), "Test"), null);
});
