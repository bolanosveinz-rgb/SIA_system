import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isInsideTupi } from "@/lib/places";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideTupi(lat, lng)) {
    return NextResponse.json({ error: "Choose a location within the Tupi map area." }, { status: 400 });
  }
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`geocode:${client}`, 1, 1000)) {
    return NextResponse.json({ error: "Please wait a moment before looking up another location." }, { status: 429 });
  }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { "user-agent": "ServeLink-Tupi/1.0 (community reporting platform)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      console.error("Nominatim reverse geocode failed:", response.status);
      return NextResponse.json({ error: "Address lookup is temporarily unavailable." }, { status: 502 });
    }
    const result = (await response.json()) as { display_name?: string; address?: Record<string, string> };
    return NextResponse.json({
      address: result.display_name ?? "",
      barangay: result.address?.suburb ?? result.address?.village ?? result.address?.neighbourhood ?? result.address?.town ?? "",
    });
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return NextResponse.json({ error: "Address lookup is temporarily unavailable." }, { status: 502 });
  }
}
