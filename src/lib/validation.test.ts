import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema, reportSchema } from "@/lib/validation";

test("accepts a valid resident registration and normalizes email", () => {
  const result = registerSchema.safeParse({
    name: "Juan Dela Cruz",
    email: "  Juan@example.com ",
    phone: "+63 917 123 4567",
    barangay: "Poblacion",
    address: "Poblacion, Tupi",
    password: "LongSecurePassword1!",
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.email, "juan@example.com");
});

test("rejects barangays outside Tupi", () => {
  const result = registerSchema.safeParse({
    name: "Juan Dela Cruz",
    email: "juan@example.com",
    phone: "+63 917 123 4567",
    barangay: "Koronadal",
    address: "Downtown, South Cotabato",
    password: "LongSecurePassword1!",
  });
  assert.equal(result.success, false);
});

test("rejects passwords longer than bcrypt's 72-byte input limit", () => {
  const result = registerSchema.safeParse({
    name: "Juan Dela Cruz",
    email: "juan@example.com",
    phone: "+63 917 123 4567",
    barangay: "Poblacion",
    address: "Poblacion, Tupi",
    password: "á".repeat(37),
  });
  assert.equal(result.success, false);
});

test("accepts a valid report pin within the municipal polygon", () => {
  const result = reportSchema.safeParse({
    title: "Road needs repair",
    description: "A damaged road near the public market needs attention.",
    lat: 6.3333,
    lng: 124.95,
  });
  assert.equal(result.success, true);
});

test("rejects report pins inside the map bounding box but outside the Tupi boundary", () => {
  const result = reportSchema.safeParse({
    title: "Road needs repair",
    description: "A damaged road near the public market needs attention.",
    lat: 6.34,
    lng: 124.87,
  });
  assert.equal(result.success, false);
});

test("rejects non-Cloudinary or insecure report image URLs", () => {
  const result = reportSchema.safeParse({
    title: "Road needs repair",
    description: "A damaged road near the public market needs attention.",
    lat: 6.3333,
    lng: 124.95,
    photoUrl: "https://example.com/photo.jpg",
  });
  assert.equal(result.success, false);
});
