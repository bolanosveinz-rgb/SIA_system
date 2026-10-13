"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CalendarClock, LocateFixed, MapPin, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { BARANGAYS, isInsideTupi } from "@/lib/places";
import { uploadToCloudinary } from "@/lib/upload";

const CommunityMap = dynamic(() => import("@/components/community-map").then((module) => module.CommunityMap), {
  ssr: false,
  loading: () => <div className="h-[min(64vh,660px)] animate-pulse rounded-2xl bg-[var(--line)]" />,
});

type ReportPin = { id: string; title: string; lat: number; lng: number; status: string; createdAt: string };
type User = { id: string; role: "ADMIN" | "RESIDENT"; profile?: { barangay?: string } | null };

export default function MapPage() {
  const [selected, setSelected] = useState<{ lat: number; lng: number; address: string; barangay: string } | null>(null);
  const [reports, setReports] = useState<ReportPin[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const session = await fetch("/api/auth/me").then((response) => response.json());
        if (!active) return;
        setUser(session.user);
        const url = session.user?.role === "ADMIN" ? "/api/reports" : "/api/reports/map";
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (active) setReports(data.reports);
        } else if (response.status !== 401) {
          throw new Error("Report locations could not be loaded.");
        }
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Report locations could not be loaded.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function selectLocation(lat: number, lng: number) {
    if (!isInsideTupi(lat, lng)) return toast.error("Please choose a location within the Tupi map area.");
    const residentBarangay = user?.profile?.barangay ?? "";
    setSelected({ lat, lng, address: "Looking up address…", barangay: residentBarangay });
    setReverseLoading(true);
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Address lookup failed.");
      const detected = BARANGAYS.find((name) => data.barangay?.toLowerCase().includes(name.toLowerCase())) ?? residentBarangay;
      setSelected({ lat, lng, address: data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, barangay: detected });
    } catch {
      setSelected({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}, Tupi, South Cotabato`, barangay: residentBarangay });
    } finally {
      setReverseLoading(false);
    }
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selected) return toast.error("Select a location on the map first.");
    if (!user) return toast.error("Sign in or create an account to submit a report.");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setFormLoading(true);
    try {
      let media: { url: string; publicId: string } | null = null;
      if (photo) {
        const upload = await uploadToCloudinary(photo, setUploadProgress);
        media = { url: upload.url, publicId: upload.publicId };
      }
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          lat: selected.lat,
          lng: selected.lng,
          address: selected.address,
          barangay: selected.barangay || user.profile?.barangay || "",
          photoUrl: media?.url,
          photoPublicId: media?.publicId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Your report could not be submitted.");
      setReports((items) => [data.report, ...items]);
      setSelected(null);
      setPhoto(null);
      setUploadProgress(0);
      form.reset();
      toast.success("Report sent to the LGU. Thank you for speaking up!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your report could not be submitted.");
    } finally {
      setFormLoading(false);
      setUploadProgress(0);
    }
  }

  return <>
    <SiteHeader />
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="mb-6"><Link href="/" className="text-sm font-semibold text-[var(--muted)] hover:text-[#0d9b91]">← Back to home</Link><div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]"><LocateFixed size={14} /> Community map</div><h1 className="text-3xl font-extrabold tracking-tight">Tupi, on the map.</h1><p className="mt-1 text-sm text-[var(--muted)]">Explore community reports or tap a location to report an issue.</p></div><div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--muted)]"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#ef7951]" />{reports.length} community reports</div></div></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section><CommunityMap reports={reports} selected={selected} onSelect={selectLocation} height="min(64vh, 660px)" /><p className="mt-2 text-xs text-[var(--muted)]">Tap or click anywhere inside the map extent to place your report pin.</p></section>
        <aside>
          {selected ? <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm font-bold"><MapPin size={17} className="text-[#0d9b91]" /> Report location</div><p className="mt-1 text-xs text-[var(--muted)]">Review the location, then tell us what happened.</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)]" aria-label="Clear selected location"><X size={18} /></button></div>
            <div className="mb-4 space-y-2 rounded-xl bg-[var(--background)] p-3.5 text-xs"><p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-[#0d9b91]" /><span>{reverseLoading ? "Looking up address…" : selected.address}</span></p><p className="pl-6 text-[var(--muted)]">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}{selected.barangay ? ` · ${selected.barangay}` : ""}</p><p className="flex items-center gap-2 pl-6 text-[var(--muted)]"><CalendarClock size={13} />{new Date().toLocaleString("en-PH")}</p></div>
            {user?.role === "ADMIN" ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">Administrator accounts cannot submit resident reports. Sign in with a resident account to report a concern.</p> : <form onSubmit={submitReport} className="space-y-3.5"><label className="block space-y-1.5 text-xs font-bold">Report title<Input name="title" required minLength={4} maxLength={160} placeholder="e.g. Damaged road near…" /></label><label className="block space-y-1.5 text-xs font-bold">Describe the issue<Textarea name="description" required minLength={10} maxLength={5000} placeholder="Tell us what happened and how it affects the community…" className="min-h-24 text-sm" /></label><label className="block space-y-1.5 text-xs font-bold">Photo <span className="font-normal text-[var(--muted)]">(optional)</span><span className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--line)] px-3 py-2.5 text-xs font-medium text-[var(--muted)]"><Upload size={15} /><input aria-label="Upload a report photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="min-w-0 flex-1 file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-[#08776f]" /></span>{photo && <span className="flex items-center justify-between text-xs font-normal text-[var(--muted)]">{photo.name}<button type="button" onClick={() => setPhoto(null)} aria-label="Remove selected photo"><X size={14} /></button></span>}</label>{uploadProgress > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full bg-[#0d9b91] transition-all" style={{ width: `${uploadProgress}%` }} /></div>}{!user && <p className="text-xs text-[var(--muted)]">Please <Link className="font-bold text-[#0d9b91] underline" href="/login">sign in</Link> or <Link className="font-bold text-[#0d9b91] underline" href="/register">create an account</Link> to submit.</p>}<Button loading={formLoading} type="submit" className="w-full">Submit report</Button><p className="text-center text-[10px] leading-4 text-[var(--muted)]">Your report is shared with authorized LGU staff for follow-up.</p></form>}
          </Card> : <Card className="flex min-h-72 flex-col items-center justify-center p-6 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[#0d9b91]"><MapPin size={25} /></div><h2 className="font-bold">Choose a location</h2><p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted)]">Tap anywhere on the map to drop a pin and tell the LGU about a community concern.</p><div className="mt-5 flex items-center gap-2 rounded-full bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#0d9b91]" /> Live community map</div></Card>}
        </aside>
      </div>
    </main>
  </>;
}
