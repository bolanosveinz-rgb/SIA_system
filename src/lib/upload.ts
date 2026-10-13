export type UploadedMedia = { url: string; publicId: string; type: "IMAGE" | "VIDEO" };

export async function uploadToCloudinary(file: File, onProgress?: (progress: number) => void): Promise<UploadedMedia> {
  const isVideo = file.type.startsWith("video/");
  const allowed = isVideo
    ? ["video/mp4", "video/webm", "video/quicktime"]
    : ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Use a JPG, PNG, WebP image or MP4, WebM, MOV video.");
  const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) throw new Error(isVideo ? "Videos must be smaller than 50 MB." : "Images must be smaller than 10 MB.");
  const signatureResponse = await fetch("/api/upload/signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resourceType: isVideo ? "video" : "image" }),
  });
  const signature = await signatureResponse.json();
  if (!signatureResponse.ok) throw new Error(signature.error ?? "Media upload is not configured.");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("folder", signature.folder);
  form.append("signature", signature.signature);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText) as { secure_url?: string; public_id?: string; error?: { message?: string } };
        if (request.status < 200 || request.status >= 300 || !result.secure_url || !result.public_id) {
          reject(new Error(result.error?.message ?? "The media upload failed."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id, type: isVideo ? "VIDEO" : "IMAGE" });
      } catch {
        reject(new Error("The media upload returned an invalid response."));
      }
    };
    request.onerror = () => reject(new Error("Network error while uploading media."));
    request.onabort = () => reject(new Error("Media upload was cancelled."));
    request.send(form);
  });
}
