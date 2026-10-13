import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/route";

function request(ip: string, question = "How can I report a local concern?") {
  return new NextRequest("http://localhost:3000/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ question }),
  });
}

test("calls Google Gemini server-side with its API key in the header and returns the answer", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  let captured: { url: string; key: string | null; body: Record<string, unknown> } | undefined;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
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
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
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
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  let sentQuestion: string | undefined;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
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
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("rejects a Claude model ID instead of sending it to Google Gemini", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  let called = false;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
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
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("turns Gemini invalid-key errors into a safe and actionable response", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
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
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});

test("explains Gemini quota exhaustion and preserves a valid retry interval", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldModel = process.env.GEMINI_API_MODEL;
  const oldFetch = globalThis.fetch;
  try {
    process.env.GEMINI_API_KEY = "server-only-test-key";
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
    if (oldModel === undefined) delete process.env.GEMINI_API_MODEL;
    else process.env.GEMINI_API_MODEL = oldModel;
  }
});
