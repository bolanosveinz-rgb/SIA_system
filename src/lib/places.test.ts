import assert from "node:assert/strict";
import test from "node:test";
import { BARANGAYS, isInsideTupi, TUPI_BOUNDARY, TUPI_CENTER } from "@/lib/places";

test("contains the 17 currently listed Tupi barangays", () => {
  assert.equal(BARANGAYS.length, 17);
  assert.equal(new Set(BARANGAYS).size, 17);
  assert.ok(BARANGAYS.includes("Juan-Loreto Tamayo"));
});

test("accepts coordinates inside the Tupi municipal outline", () => {
  assert.equal(isInsideTupi(...TUPI_CENTER), true);
  assert.equal(isInsideTupi(6.35, 124.88), true);
});

test("rejects locations outside the actual municipal polygon", () => {
  assert.equal(isInsideTupi(6.3333, 124.95), true);
  assert.equal(isInsideTupi(6.34, 124.87), false);
  assert.equal(isInsideTupi(6.2, 124.95), false);
});

test("keeps the OSM boundary as a closed polygon", () => {
  const points = TUPI_BOUNDARY.geometry.coordinates[0];
  assert.ok(points.length > 400);
  assert.deepEqual(points[0], points.at(-1));
});
