"use client";

import { useEffect } from "react";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { TUPI_BOUNDARY, TUPI_BOUNDS, TUPI_CENTER } from "@/lib/places";
import { StatusBadge } from "@/components/ui";

type MapReport = {
  id: string;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  status: string;
  createdAt: string;
  resident?: { name: string };
};

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:#0d9b91;border:3px solid white;box-shadow:0 4px 12px #12365a55;transform:rotate(-45deg)"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

const reportIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#12365a;border:3px solid white;box-shadow:0 2px 8px #12365a88"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function ClickHandler({ onSelect }: { onSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      if (onSelect) onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function HeatLayer({ reports }: { reports: MapReport[] }) {
  const map = useMap();
  useEffect(() => {
    const heat = L.heatLayer(reports.map((report) => [report.lat, report.lng, report.status === "PENDING" ? 0.9 : 0.55]), {
      radius: 30,
      blur: 22,
      maxZoom: 14,
      gradient: { 0.25: "#45c4b6", 0.55: "#facc5c", 0.82: "#f0784b", 1: "#e43b52" },
    });
    heat.addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, reports]);
  return null;
}

export function CommunityMap({
  reports = [],
  selected,
  onSelect,
  height = "520px",
}: {
  reports?: MapReport[];
  selected?: { lat: number; lng: number } | null;
  onSelect?: (lat: number, lng: number) => void;
  height?: string;
}) {
  const bounds = L.latLngBounds(TUPI_BOUNDS[0], TUPI_BOUNDS[1]);
  return <div className="relative z-0 overflow-hidden rounded-2xl border border-[var(--line)]" style={{ height }}>
    <MapContainer center={TUPI_CENTER} zoom={13} minZoom={11} maxZoom={18} maxBounds={bounds} maxBoundsViscosity={1} scrollWheelZoom className="h-full w-full" aria-label="Interactive map of Tupi, South Cotabato">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <GeoJSON data={TUPI_BOUNDARY} style={{ color: "#0d9b91", weight: 2, fillColor: "#0d9b91", fillOpacity: 0.07 }} />
      <ClickHandler onSelect={onSelect} />
      <HeatLayer reports={reports} />
      {reports.map((report) => <Marker key={report.id} position={[report.lat, report.lng]} icon={reportIcon}>
        <Popup><div className="min-w-44"><p className="font-bold">{report.title}</p>{report.description && <p className="mt-1 text-xs">{report.description}</p>}{report.resident && <p className="mt-2 text-xs">Reported by {report.resident.name}</p>}<div className="mt-2"><StatusBadge status={report.status} /></div><p className="mt-2 text-[10px]">{new Date(report.createdAt).toLocaleString("en-PH")}</p></div></Popup>
      </Marker>)}
      {selected && <Marker position={[selected.lat, selected.lng]} icon={pinIcon}><Popup>Selected report location</Popup></Marker>}
    </MapContainer>
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border border-white/80 bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm">Tupi municipal boundary · © OpenStreetMap</div>
  </div>;
}
