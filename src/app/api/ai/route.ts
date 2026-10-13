import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";
import { checkRateLimit, getClientAddress } from "@/lib/rate-limit";

const messageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().trim().min(1).max(1000),
});
const historySchema = z.array(messageSchema).max(12)
  .refine((messages) => messages.every((message, index) => message.role === (index % 2 === 0 ? "user" : "model")))
  .refine((messages) => messages.length === 0 || messages[messages.length - 1].role === "model");
const questionSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: historySchema.optional(),
});

function isQuotaLimited(response: Response) {
  return response.status === 429;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const client = getClientAddress(request.headers);
  if (!checkRateLimit(`assistant:${client}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "You’ve asked a lot of questions recently. Please try again later." }, { status: 429 });
  }
  try {
    const parsed = questionSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "The community assistant is not configured yet. Set GEMINI_API_KEY in the app environment and restart the app." },
        { status: 503 },
      );
    }
    const model = (process.env.GEMINI_CHAT_MODEL ?? process.env.GEMINI_API_MODEL ?? "gemini-2.5-flash").trim();
    if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model)) {
      console.error("Gemini assistant is misconfigured: GEMINI_CHAT_MODEL or GEMINI_API_MODEL must be a Gemini model ID.");
      return NextResponse.json(
        { error: "GEMINI_CHAT_MODEL must be a Gemini model ID (for example, gemini-2.5-flash-lite)." },
        { status: 503 },
      );
    }
    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{
          text: "You are ServeLink, a helpful community information assistant for Tupi, South Cotabato, Philippines. Help residents understand how to use the platform and find municipal services. Be concise, kind, and clear. Never invent current LGU schedules, phone numbers, policies, or emergency details. If unsure, say to contact the Municipality of Tupi directly. For emergencies, tell the resident to contact local emergency services immediately.",
        }],
      },
      contents: [
        ...(parsed.data.history ?? []).map(({ role, text }) => ({ role, parts: [{ text }] })),
        { role: "user", parts: [{ text: parsed.data.question }] },
      ],
      generationConfig: { maxOutputTokens: 700 },
    });
    const requestGemini = (modelId: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: requestBody,
      signal: AbortSignal.timeout(20000),
    });
    let response = await requestGemini(model);
    let responseModel = model;
    if (isQuotaLimited(response)) {
      responseModel = model === "gemini-2.5-flash-lite" ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
      console.warn("Gemini model quota reached; retrying with the alternate text model.", { model, fallbackModel: responseModel });
      response = await requestGemini(responseModel);
    }
    if (!response.ok) {
      const requestId = response.headers.get("x-guploader-uploadid");
      const result = await response.json().catch(() => null) as { error?: { status?: string } } | null;
      const providerStatus = result?.error?.status;
      console.error("Gemini request failed:", { status: response.status, providerStatus, requestId });
      if (response.status === 400 && providerStatus === "INVALID_ARGUMENT") {
        return NextResponse.json(
          { error: "Gemini rejected the API key or request. Verify GEMINI_API_KEY in Google AI Studio and that the key is enabled for the Gemini API." },
          { status: 502 },
        );
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Google Gemini rejected this API key. Create or enable a Gemini API key in Google AI Studio, update GEMINI_API_KEY, and restart the app." },
          { status: 502 },
        );
      }
      if (response.status === 404 || providerStatus === "NOT_FOUND") {
        return NextResponse.json(
          { error: `Google Gemini could not find model "${responseModel}". Check GEMINI_API_MODEL against the Gemini models available to your API key.` },
          { status: 502 },
        );
      }
      if (response.status === 429 || providerStatus === "RESOURCE_EXHAUSTED") {
        const retryAfter = response.headers.get("retry-after");
        const headers = retryAfter && /^\d+$/.test(retryAfter) ? { "Retry-After": retryAfter } : undefined;
        return NextResponse.json({
          error: "Google Gemini has reached this key's request-rate or usage quota. Wait for the quota to reset, or check the key's Google AI Studio project, billing, and model limits.",
        }, { status: 503, headers });
      }
      return NextResponse.json({ error: "The assistant is temporarily unavailable. Please try again shortly." }, { status: 502 });
    }
    const result = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };
    const candidate = result.candidates?.[0];
    const answer = candidate?.content?.parts?.map((part) => part.text).filter((text): text is string => Boolean(text)).join("\n").trim();
    if (!answer && (result.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY")) {
      return NextResponse.json({ error: "Gemini could not answer that question. Please rephrase it and try again." }, { status: 400 });
    }
    if (!answer) return NextResponse.json({ error: "The Gemini assistant returned an empty response. Please try again." }, { status: 502 });
    return NextResponse.json({ answer });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "The assistant took too long to respond. Please try again." }, { status: 504 });
    }
    return routeError(error);
  }
}
