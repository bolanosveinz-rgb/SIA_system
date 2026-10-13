import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { checkRateLimit, getClientAddress } from "@/lib/rate-limit";

const questionSchema = z.object({ question: z.string().trim().min(3).max(1000) });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const client = getClientAddress(request.headers);
  if (!checkRateLimit(`assistant:${client}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "You’ve asked a lot of questions recently. Please try again later." }, { status: 429 });
  }
  try {
    const parsed = questionSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "The community assistant is not configured yet. Please contact the LGU." }, { status: 503 });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "claude-sonnet-5-5",
        max_tokens: 700,
        system: "You are ServeLink, a helpful community information assistant for Tupi, South Cotabato, Philippines. Help residents understand how to use the platform and find municipal services. Be concise, kind, and clear. Never invent current LGU schedules, phone numbers, policies, or emergency details. If unsure, say to contact the Municipality of Tupi directly. For emergencies, tell the resident to contact local emergency services immediately.",
        messages: [{ role: "user", content: parsed.data.question }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const requestId = response.headers.get("request-id");
      console.error("Anthropic request failed:", { status: response.status, requestId });
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Anthropic rejected the AI_API_KEY. Create a valid API key in the Anthropic Console, update your app’s environment, and restart the app." },
          { status: 502 },
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          { error: "This Anthropic key does not have access to the requested model. Check the account’s model access and AI_MODEL setting." },
          { status: 502 },
        );
      }
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Anthropic could not find the requested model. Check that AI_MODEL is available to your account." },
          { status: 502 },
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: "The AI assistant is temporarily rate-limited. Please try again shortly." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "The assistant is temporarily unavailable. Please try again shortly." }, { status: 502 });
    }
    const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const answer = result.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n").trim();
    if (!answer) return NextResponse.json({ error: "The assistant returned an empty response. Please try another question." }, { status: 502 });
    return NextResponse.json({ answer });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "The assistant took too long to respond. Please try again." }, { status: 504 });
    }
    return routeError(error);
  }
}
