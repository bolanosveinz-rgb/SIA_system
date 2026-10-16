import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { routeError, validationError } from "@/lib/http";

const GEMINI_REQUEST_TIMEOUT_MS = 30_000;

const imageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(4).max(5_600_000).regex(/^[A-Za-z0-9+/]+={0,2}$/).refine((data) => data.length % 4 === 0),
});
const messageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().trim().min(1),
  image: imageSchema.optional(),
});
const historySchema = z.array(messageSchema).max(12)
  .refine((messages) => messages.every((message, index) => message.role === (index % 2 === 0 ? "user" : "model")))
  .refine((messages) => messages.length === 0 || messages[messages.length - 1].role === "model")
  .refine((messages) => messages.every((message) => message.role === "user" || !message.image))
  .refine((messages) => messages.filter((message) => message.image).length <= 1);
const questionSchema = z.object({
  question: z.string().trim().default(""),
  image: imageSchema.optional(),
  history: historySchema.optional(),
  thinkingMode: z.boolean().optional().default(false),
}).refine((data) => data.question.length > 0 || Boolean(data.image), {
  message: "Enter a message or attach an image.",
  path: ["question"],
}).refine((data) => Number(Boolean(data.image)) + (data.history ?? []).filter((message) => message.image).length <= 1, {
  message: "Only one photo can be included in a chat request.",
  path: ["image"],
});

function isQuotaLimited(response: Response) {
  return response.status === 429;
}

function isModelUnavailable(response: Response) {
  return response.status === 404;
}

function isRetryableGeminiFailure(response: Response) {
  return isQuotaLimited(response) || isModelUnavailable(response) || response.status >= 500;
}

async function discoverGeminiModels(apiKey: string) {
  const models: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 2; page += 1) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      console.warn("Gemini model discovery request failed.", {
        error: error instanceof Error ? error.name : "Unknown error",
      });
      return { models, authorizationFailed: false };
    }

    if (!response.ok) {
      console.warn("Gemini model discovery returned an error.", { status: response.status });
      return { models, authorizationFailed: response.status === 401 || response.status === 403 };
    }

    let result: {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      nextPageToken?: string;
    };
    try {
      result = await response.json();
    } catch {
      console.warn("Gemini model discovery returned invalid JSON.");
      return { models, authorizationFailed: false };
    }
    for (const model of result.models ?? []) {
      const name = model.name?.replace(/^models\//, "");
      if (
        name?.startsWith("gemini-") &&
        !/(embedding|image|tts|audio|robotics|computer-use)/i.test(name) &&
        model.supportedGenerationMethods?.includes("generateContent")
      ) {
        models.push(name);
      }
    }
    pageToken = result.nextPageToken;
    if (!pageToken) break;
  }

  models.sort((left, right) => {
    const leftFlash = left.includes("flash") ? 1 : 0;
    const rightFlash = right.includes("flash") ? 1 : 0;
    if (leftFlash !== rightFlash) return rightFlash - leftFlash;
    const leftVersion = left.match(/^gemini-(\d+)(?:\.(\d+))?/);
    const rightVersion = right.match(/^gemini-(\d+)(?:\.(\d+))?/);
    const versionDifference =
      Number(rightVersion?.[1] ?? 0) - Number(leftVersion?.[1] ?? 0) ||
      Number(rightVersion?.[2] ?? 0) - Number(leftVersion?.[2] ?? 0);
    if (versionDifference) return versionDifference;
    return left.localeCompare(right);
  });

  return { models: [...new Set(models)], authorizationFailed: false };
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    const parsed = questionSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const configuredApiKeys = process.env.GEMINI_API_KEYS?.trim() || process.env.GEMINI_API_KEY || "";
    const apiKeys = [...new Set(configuredApiKeys.split(/[\r\n,]/).map((apiKey) => apiKey.trim()).filter(Boolean))];
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: "The community assistant is not configured yet. Set GEMINI_API_KEYS or GEMINI_API_KEY in the app environment and restart the app." },
        { status: 503 },
      );
    }
    const model = (process.env.GEMINI_CHAT_MODEL ?? process.env.GEMINI_API_MODEL ?? "gemini-2.5-flash").trim();
    if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model)) {
      console.error("Gemini assistant is misconfigured: GEMINI_CHAT_MODEL or GEMINI_API_MODEL must be a Gemini model ID.");
      return NextResponse.json(
        { error: "GEMINI_CHAT_MODEL must be a Gemini model ID (for example, gemini-2.5-flash)." },
        { status: 503 },
      );
    }
    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{
          text: `You are ServeLink, a helpful general-purpose assistant for residents of Tupi, South Cotabato. Use your broad knowledge to answer questions about any topic, country, or culture worldwide; do not limit answers to Tupi or ServeLink. Also help residents use ServeLink and find municipal services. Be accurate, clear, and respectful. For current or time-sensitive worldwide facts, say when you cannot verify them. Never invent current LGU schedules, phone numbers, policies, or emergency details; when unsure about local or time-sensitive facts, say so and direct the resident to the Municipality of Tupi. For emergencies, tell the resident to contact local emergency services immediately.${parsed.data.thinkingMode ? " Take extra care to consider the available context and provide a thorough, well-organized answer with relevant details and practical next steps. Do not reveal private reasoning." : ""}`,
        }],
      },
      contents: [
        ...(parsed.data.history ?? []).map(({ role, text, image }) => ({
          role,
          parts: [
            { text },
            ...(image ? [{ inlineData: image }] : []),
          ],
        })),
        {
          role: "user",
          parts: [
            { text: parsed.data.question || "Please describe this image and help me understand how it relates to Tupi community services." },
            ...(parsed.data.image ? [{ inlineData: parsed.data.image }] : []),
          ],
        },
      ],
      generationConfig: { maxOutputTokens: parsed.data.thinkingMode ? 4096 : 1024 },
    });
    const requestGemini = (modelId: string, apiKey: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: requestBody,
      signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
    });
    let response: Response | undefined;
    let responseModel = model;
    const alternateModel = model === "gemini-2.5-flash-lite" ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
    for (const [keyIndex, apiKey] of apiKeys.entries()) {
      responseModel = model;
      response = await requestGemini(model, apiKey);
      const attemptedModels = new Set([model]);
      if (isRetryableGeminiFailure(response)) {
        const reason = isQuotaLimited(response) ? "quota reached" : isModelUnavailable(response) ? "model unavailable" : "provider error";
        responseModel = alternateModel;
        attemptedModels.add(responseModel);
        console.warn(`Gemini ${reason}; retrying with the alternate text model.`, { model, fallbackModel: responseModel });
        response = await requestGemini(responseModel, apiKey);
      }
      if (isModelUnavailable(response) || response.status >= 500) {
        const discovered = await discoverGeminiModels(apiKey);
        if (discovered.authorizationFailed) {
          response = new Response(JSON.stringify({ error: { status: "PERMISSION_DENIED" } }), { status: 403 });
        } else {
          const availableModels = discovered.models.filter((availableModel) => !attemptedModels.has(availableModel));
          for (const availableModel of availableModels.slice(0, 3)) {
            attemptedModels.add(availableModel);
            console.info("Trying an available Gemini model discovered for this API key.", { model: availableModel });
            responseModel = availableModel;
            response = await requestGemini(responseModel, apiKey);
            if (!isRetryableGeminiFailure(response)) break;
          }
        }
      }
      if (response.ok) break;
      if (keyIndex < apiKeys.length - 1 && (response.status === 401 || response.status === 403 || isRetryableGeminiFailure(response))) {
        console.warn("Gemini request failed; trying the next configured API key.", {
          status: response.status,
          remainingKeys: apiKeys.length - keyIndex - 1,
        });
        continue;
      }
      break;
    }
    if (!response) return NextResponse.json({ error: "Google Gemini could not complete the request." }, { status: 502 });
    if (!response.ok) {
      const requestId = response.headers.get("x-guploader-uploadid");
      const result = await response.json().catch(() => null) as { error?: { status?: string } } | null;
      const providerStatus = result?.error?.status;
      console.error("Gemini request failed:", { status: response.status, providerStatus, requestId });
      if (response.status === 400 && providerStatus === "INVALID_ARGUMENT") {
        return NextResponse.json(
          { error: "Gemini rejected the API key or request. Verify your Gemini API key in Google AI Studio and confirm it is enabled for the Gemini API." },
          { status: 502 },
        );
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Google Gemini rejected all tried API keys. Create or enable valid Gemini API keys in Google AI Studio, update the app environment, and restart the app." },
          { status: 502 },
        );
      }
      if (response.status === 404 || providerStatus === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Google Gemini could not find an available text model for this API key. The assistant tried the configured model, its fallback, and models listed as supporting generateContent. Check that this key has Gemini API access, then set GEMINI_CHAT_MODEL to one of its available models." },
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
      if (response.status >= 500 || providerStatus === "INTERNAL" || providerStatus === "UNAVAILABLE") {
        return NextResponse.json(
          { error: "Google Gemini returned server errors for the configured models and another text model available to this API key. Check Google AI Studio service status and the key's project/model access, then try again." },
          { status: 503 },
        );
      }
      if (response.status === 400) {
        return NextResponse.json(
          { error: "Google Gemini rejected this chat request. Check that GEMINI_CHAT_MODEL supports text generation and try starting a new chat." },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: `Google Gemini could not complete the request (HTTP ${response.status}). Check the Gemini API key, model access, and project status, then try again.` },
        { status: 502 },
      );
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
      return NextResponse.json(
        { error: "Google Gemini did not respond within 30 seconds. Your message is still available to retry. Try again shortly; if it keeps timing out, use a shorter question or a smaller photo." },
        { status: 504 },
      );
    }
    return routeError(error);
  }
}
