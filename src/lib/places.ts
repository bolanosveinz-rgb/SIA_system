export const BARANGAYS = [
  "Acmonan",
  "Bololmala",
  "Bunao",
  "Cabulan",
  "Cablon",
  " Cebuano",
  "Crossing Rubber",
  "Kablon",
  "Kalkam",
  "Kibao",
  "Linan",
  "Linan 2",
  "Linan 3",
  "Lunen",
  "Miasong",
  "Palian",
  "Poblacion",
  "Polonuling",
  "Simbo",
  "Tubeng",
  "Tupi",
].map((name) => name.trim());

export const TUPI_CENTER: [number, number] = [6.3333, 124.95];
export const TUPI_BOUNDS: [[number, number], [number, number]] = [
  [6.19, 124.77],
  [6.49, 125.12],
];

export function isInsideTupi(lat: number, lng: number) {
  return (
    lat >= TUPI_BOUNDS[0][0] &&
    lat <= TUPI_BOUNDS[1][0] &&
    lng >= TUPI_BOUNDS[0][1] &&
    lng <= TUPI_BOUNDS[1][1]
  );
}
