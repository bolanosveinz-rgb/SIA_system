export const BARANGAYS = [
  "Acmonan",
  "Bololmala",
  "Bunao",
  "Cabulan",
  "Cebuano",
  "Crossing Rubber",
  "Kablon",
  "Kalkam",
  "Linan",
  "Lunen",
  "Miasong",
  "Palian",
  "Poblacion",
  "Polonuling",
  "Simbo",
  "Tubeng",
];

export const TUPI_CENTER: [number, number] = [6.3333, 124.95];
import boundary from "@/data/tupi-boundary.json";
import type { Feature, Polygon } from "geojson";

export const TUPI_BOUNDS: [[number, number], [number, number]] = [
  [6.2382124, 124.8680091],
  [6.4610003, 125.1198653],
];
export const TUPI_BOUNDARY = boundary as Feature<Polygon>;

export function isInsideTupi(lat: number, lng: number) {
  if (
    lat < TUPI_BOUNDS[0][0] ||
    lat > TUPI_BOUNDS[1][0] ||
    lng < TUPI_BOUNDS[0][1] ||
    lng > TUPI_BOUNDS[1][1]
  ) return false;
  const polygon = TUPI_BOUNDARY.geometry.coordinates[0];
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[previous];
    const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-9 && lng >= Math.min(x1, x2) && lng <= Math.max(x1, x2) && lat >= Math.min(y1, y2) && lat <= Math.max(y1, y2)) {
      return true;
    }
    if ((y1 > lat) !== (y2 > lat) && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) {
      inside = !inside;
    }
  }
  return inside;
}
