import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function validationError(error: ZodError) {
  const message = error.issues[0]?.message ?? "Check the information and try again.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export function routeError(error: unknown, message = "Something went wrong. Please try again.") {
  console.error("API route failed:", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
