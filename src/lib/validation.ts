import { z } from "zod";
import { BARANGAYS, isInsideTupi } from "@/lib/places";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(191).transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(32),
  barangay: z.string().refine((value) => BARANGAYS.includes(value), "Choose a barangay in Tupi."),
  address: z.string().trim().min(5, "Enter your complete address.").max(300),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number.").max(191),
  password: z.string().min(1, "Enter your password."),
});

export const reportSchema = z.object({
  title: z.string().trim().min(4, "Title must be at least 4 characters.").max(160),
  description: z.string().trim().min(10, "Description must be at least 10 characters.").max(5000),
  lat: z.number().min(6.2382124).max(6.4610003),
  lng: z.number().min(124.8680091).max(125.1198653),
  address: z.string().trim().max(300).default(""),
  barangay: z.string().trim().max(100).default(""),
  photoUrl: z.string().url().max(2048).refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
  }, "Report photos must be stored securely.").optional().nullable(),
  photoPublicId: z.string().max(255).optional().nullable(),
}).refine((value) => isInsideTupi(value.lat, value.lng), {
  message: "Select a location within Tupi.",
  path: ["lat"],
});

export const newsSchema = z.object({
  caption: z.string().trim().min(3, "Write a caption for this update.").max(10000),
  media: z.array(z.object({
    url: z.string().url().max(2048).refine((value) => {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
    }, "News media must be stored securely."),
    publicId: z.string().min(1).max(255),
    type: z.enum(["IMAGE", "VIDEO"]),
  })).max(5).default([]),
});
