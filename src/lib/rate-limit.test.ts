import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit, getClientAddress } from "@/lib/rate-limit";

test("allows up to the configured attempt count and rejects additional attempts", () => {
  const key = `test:${crypto.randomUUID()}`;
  assert.equal(checkRateLimit(key, 2, 60_000), true);
  assert.equal(checkRateLimit(key, 2, 60_000), true);
  assert.equal(checkRateLimit(key, 2, 60_000), false);
});

test("uses the server-appended forwarded client address rather than a spoofable first entry", () => {
  assert.equal(getClientAddress(new Headers({ "x-forwarded-for": "spoofed, 198.51.100.25" })), "198.51.100.25");
  assert.equal(getClientAddress(new Headers({ "x-forwarded-for": "" })), "unknown");
});
