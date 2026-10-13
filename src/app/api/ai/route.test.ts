import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/route";

function request(
  ip: string,
  question = "How can I report a local concern?",
  history?: Array<{ role: "user" | "model"; text: string }>,
) {
  return new NextRequest("http://localhost:3000/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ question, ...(history ? { history } : {}) }),
  });
}

test("calls Google Gemini server-side with its API key in the header and returns the answer", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  let captured: { url: string; key: string | null; body: Record<string, unknown> } | undefined;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    delete process.env.GEMINI_CHAT_MODEL;
    process.env.GEMINI_API_MODEL = "gemini-2.5-flash";
    globalThis.fetch = async (input, init) => {
      captured = {
        url: String(input),
        key: new Headers(init?.headers).get("x-goog-api-key"),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      };
      return Response.json({
        candidates: [{ content: { parts: [{ text: "You can submit a report on the community map." }] } }],
      });
    };

    const response = await POST(request("198.51.100.101"));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.answer, "You can submit a report on the community map.");
    assert.ok(captured);
    assert.match(captured.url, /\/v1beta\/models\/gemini-2\.5-flash:generateContent$/);
    assert.equal(captured.key, "server-only-test-key");
    assert.doesNotMatch(JSON.stringify(result), /server-only-test-key/);
    assert.deepEqual(captured.body.contents, [{
      role: "user",
      parts: [{ text: "How can I report a local concern?" }],
    }]);
    assert.ok(captured.body.systemInstruction);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("uses GEMINI_CHAT_MODEL ahead of the backward-compatible API model setting", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  let requestedUrl = "";
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";
    process.env.GEMINI_API_MODEL = "gemini-2.5-flash";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return Response.json({
        candidates: [{ content: { parts: [{ text: "Hello from the configured model." }] } }],
      });
    };

    const response = await POST(request("198.51.100.106"));
    assert.equal(response.status, 200);
    assert.match(requestedUrl, /\/v1beta\/models\/gemini-2\.5-flash-lite:generateContent$/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("sends prior chat messages to Gemini as conversation context", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldFetch = globalThis.fetch;
  let sentContents: unknown;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { contents: unknown };
      sentContents = body.contents;
      return Response.json({ candidates: [{ content: { parts: [{ text: "You can track it in My reports." }] } }] });
    };

    const response = await POST(request("198.51.100.107", "Where can I track it?", [
      { role: "user", text: "How do I submit a report?" },
      { role: "model", text: "You can submit one from the community map." },
    ]));
    assert.equal(response.status, 200);
    assert.deepEqual(sentContents, [
      { role: "user", parts: [{ text: "How do I submit a report?" }] },
      { role: "model", parts: [{ text: "You can submit one from the community map." }] },
      { role: "user", parts: [{ text: "Where can I track it?" }] },
    ]);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
  }
});

test("rejects chat history that does not alternate user and model messages", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldFetch = globalThis.fetch;
  let called = false;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";
    globalThis.fetch = async () => {
      called = true;
      return Response.json({});
    };

    const response = await POST(request("198.51.100.108", "Next question", [
      { role: "user", text: "First question" },
      { role: "user", text: "Invalid repeated user message" },
    ]));
    assert.equal(response.status, 400);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
  }
});

test("returns actionable setup guidance when the Gemini key is missing", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    const response = await POST(request("198.51.100.102"));
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.match(result.error, /GEMINI_API_KEY/);
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});

test("accepts a question shorter than three characters", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  let sentQuestion: string | undefined;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    delete process.env.GEMINI_CHAT_MODEL;
    process.env.GEMINI_API_MODEL = "gemini-2.5-flash";
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
      };
      sentQuestion = body.contents[0]?.parts[0]?.text;
      return Response.json({
        candidates: [{ content: { parts: [{ text: "Here is an answer." }] } }],
      });
    };

    const response = await POST(request("198.51.100.105", "AI"));
    assert.equal(response.status, 200);
    assert.equal(sentQuestion, "AI");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("rejects a Claude model ID instead of sending it to Google Gemini", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  let called = false;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    delete process.env.GEMINI_CHAT_MODEL;
    process.env.GEMINI_API_MODEL = "claude-sonnet-5-5";
    globalThis.fetch = async () => {
      called = true;
      return Response.json({});
    };
    const response = await POST(request("198.51.100.103"));
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.match(result.error, /must be a Gemini model ID/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("turns Gemini invalid-key errors into a safe and actionable response", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    delete process.env.GEMINI_CHAT_MODEL;
    process.env.GEMINI_API_MODEL = "gemini-2.5-flash";
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { code: 403, status: "PERMISSION_DENIED", message: "Sensitive provider error details." },
    }), { status: 403 });
    const response = await POST(request("198.51.100.104"));
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.match(body.error, /Google Gemini rejected this API key/);
    assert.doesNotMatch(body.error, /Sensitive provider error details/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("explains Gemini quota exhaustion and preserves a valid retry interval", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    delete process.env.GEMINI_CHAT_MODEL;
    process.env.GEMINI_API_MODEL = "gemini-2.5-flash";
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { code: 429, status: "RESOURCE_EXHAUSTED" },
    }), { status: 429, headers: { "retry-after": "60" } });
    const response = await POST(request("198.51.100.106"));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.match(body.error, /quota/);
    assert.equal(response.headers.get("retry-after"), "60");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("retries a quota-limited primary model with the alternate Gemini text model", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  const requestedModels: string[] = [];
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    delete process.env.GEMINI_CHAT_MODEL;
    process.env.GEMINI_API_MODEL = "gemini-2.5-flash";
    globalThis.fetch = async (input) => {
      requestedModels.push(String(input));
      if (requestedModels.length === 1) {
        return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status: 429 });
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: "Gemini answered using the alternate model." }] } }],
      });
    };

    const response = await POST(request("198.51.100.107"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.answer, "Gemini answered using the alternate model.");
    assert.equal(requestedModels.length, 2);
    assert.match(requestedModels[0], /models\/gemini-2\.5-flash:generateContent$/);
    assert.match(requestedModels[1], /models\/gemini-2\.5-flash-lite:generateContent$/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("retries an unavailable configured model with the alternate Gemini text model", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  const requestedModels: string[] = [];
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";
    delete process.env.GEMINI_API_MODEL;
    globalThis.fetch = async (input) => {
      requestedModels.push(String(input));
      if (requestedModels.length === 1) {
        return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: "Gemini answered using Flash." }] } }],
      });
    };

    const response = await POST(request("198.51.100.109"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.answer, "Gemini answered using Flash.");
    assert.equal(requestedModels.length, 2);
    assert.match(requestedModels[0], /models\/gemini-2\.5-flash-lite:generateContent$/);
    assert.match(requestedModels[1], /models\/gemini-2\.5-flash:generateContent$/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("explains when neither configured nor alternate Gemini model is available", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  const requestedModels: string[] = [];
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";
    delete process.env.GEMINI_API_MODEL;
    globalThis.fetch = async (input) => {
      requestedModels.push(String(input));
      if (String(input).includes("/v1beta/models?")) {
        return Response.json({ models: [] });
      }
      return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
    };

    const response = await POST(request("198.51.100.110"));
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.match(body.error, /could not find an available text model/);
    assert.equal(requestedModels.length, 3);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("discovers a generateContent model available to the Gemini key", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldChatModel = process.env.GEMINI_CHAT_MODEL;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  const requestedModels: string[] = [];
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";
    delete process.env.GEMINI_API_MODEL;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/v1beta/models?")) {
        assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "server-only-test-key");
        assert.doesNotMatch(url, /server-only-test-key/);
        return Response.json({
          models: [
            { name: "models/gemini-2.0-flash-001", supportedGenerationMethods: ["generateContent"] },
            { name: "models/gemini-3.0-flash-preview", supportedGenerationMethods: ["generateContent"] },
            { name: "models/gemini-9.0-embedding", supportedGenerationMethods: ["embedContent"] },
            { name: "models/text-embedding-latest", supportedGenerationMethods: ["generateContent"] },
          ],
        });
      }

      requestedModels.push(url);
      if (requestedModels.length <= 2) {
        return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: "Answered by an available model." }] } }],
      });
    };

    const response = await POST(request("198.51.100.111"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.answer, "Answered by an available model.");
    assert.equal(requestedModels.length, 3);
    assert.match(requestedModels[2], /models\/gemini-3\.0-flash-preview:generateContent$/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldChatModel === undefined) delete process.env.GEMINI_CHAT_MODEL;
    else process.env.GEMINI_CHAT_MODEL = oldChatModel;
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});
