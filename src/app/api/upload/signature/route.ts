import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isSameOrigin, requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const { user, response } = await requireUser();
  if (!user) return response;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Media uploads are not configured. Please contact the LGU." }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as { resourceType?: string } | null;
  const resourceType = body?.resourceType === "video" ? "video" : "image";
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = user.role === Role.ADMIN ? "servelink/news" : "servelink/reports";
  const params = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(params).digest("hex");
  return NextResponse.json({ cloudName, apiKey, timestamp, signature, folder, resourceType });
}
