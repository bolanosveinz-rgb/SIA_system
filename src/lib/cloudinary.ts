import { createHash } from "node:crypto";

export async function deleteCloudinaryAsset(publicId: string, resourceType: "image" | "video") {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary credentials are not configured.");
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  const body = new FormData();
  body.set("public_id", publicId);
  body.set("api_key", apiKey);
  body.set("timestamp", String(timestamp));
  body.set("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Cloudinary asset deletion failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}
