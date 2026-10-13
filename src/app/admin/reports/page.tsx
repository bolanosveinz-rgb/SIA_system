"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, Filter, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, StatusBadge, Textarea } from "@/components/ui";
import { BARANGAYS } from "@/lib/places";

const CommunityMap = dynamic(() => import("@/components/community-map").then((module) => module.CommunityMap), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-2xl bg-[var(--line)]" />,
});

type Report = {
  id: string; title: string; description: string; lat: number; lng: number; address: string;
  barangay: string; status: string; photoUrl: string | null; remarks: string | null; createdAt: string;
  resident: { name: string; email: string; residentProfile: { phone: string; address: string; barangay: string } | null };
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [barangay, setBarangay] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadReports = useCallback(async () => {
    const params = new URLSearchParams({ search, status, barangay, from, to });
    const response = await fetch(`/api/reports?${params}`);
    if (!response.ok) throw new Error((await response.json()).error ?? "Reports could not be loaded.");
    const result = await response.json();
    setReports(result.reports);
    setSelected((current) => current ? (result.reports.find((item: Report) => item.id === current.id) ?? current) : null);
  }, [search, status, barangay, from, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports().catch((error) => toast.error(error instanceof Error ? error.message : "Reports could not be loaded."));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  async function updateReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setUpdating(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch(`/api/reports/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: values.status, remarks: values.remarks }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "This report could not be updated.");
      toast.success("Report status updated and resident notified.");
      await loadReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This report could not be updated.");
    } finally {
      setUpdating(false);
    }
  }

  function chooseReport(report: Report) {
    setSelected(report);
    setRemarks(report.remarks ?? "");
  }

  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">Community follow-up</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Resident reports</h1><p className="mt-1 text-sm text-[var(--muted)]">Review concerns and keep residents updated on their progress.</p></div>
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[var(--muted)]"><Filter size={14} /> Filter reports</div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative sm:col-span-2 xl:col-span-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><Input aria-label="Search reports" placeholder="Search reports…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select>
        <select aria-label="Filter by barangay" value={barangay} onChange={(event) => setBarangay(event.target.value)} className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"><option value="ALL">All barangays</option>{BARANGAYS.map((place) => <option key={place}>{place}</option>)}</select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5"><CalendarDays size={15} className="shrink-0 text-[var(--muted)]" /><input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-w-0 bg-transparent text-xs outline-none" /></label>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5"><CalendarDays size={15} className="shrink-0 text-[var(--muted)]" /><input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-w-0 bg-transparent text-xs outline-none" /></label>
      </div>
    </Card>
    <div className="grid gap-5 xl:grid-cols-[1fr_1.05fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4"><div className="flex items-center gap-2 font-bold"><SlidersHorizontal size={16} className="text-[#0d9b91]" /> Reports <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">{reports.length}</span></div></div>
        <div className="max-h-[650px] divide-y divide-[var(--line)] overflow-auto">{reports.map((report) => <button key={report.id} onClick={() => chooseReport(report)} className={`w-full px-4 py-4 text-left transition hover:bg-[var(--background)] ${selected?.id === report.id ? "bg-[var(--accent-soft)]/60" : ""}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{report.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{report.resident.name} · {report.barangay || "Tupi"}</p></div><StatusBadge status={report.status} /></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{report.description}</p><p className="mt-2 text-[10px] text-[var(--muted)]">{new Date(report.createdAt).toLocaleString("en-PH")}</p></button>)}
        {!reports.length && <div className="px-4 py-12 text-center text-sm text-[var(--muted)]">No reports match these filters.</div>}</div>
      </Card>
      <div className="space-y-4">{selected ? <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4"><div><h2 className="font-bold">{selected.title}</h2><p className="mt-1 text-xs text-[var(--muted)]">Submitted {new Date(selected.createdAt).toLocaleString("en-PH")}</p></div><button onClick={() => setSelected(null)} aria-label="Close report details" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)]"><X size={17} /></button></div>
        <div className="p-4"><CommunityMap reports={[selected]} height="260px" /><p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]"><MapPin size={14} className="text-[#0d9b91]" />{selected.address || selected.barangay || "Tupi, South Cotabato"} · {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
          {selected.photoUrl && <img src={selected.photoUrl} alt="Resident report attachment" className="mt-3 max-h-64 w-full rounded-xl object-cover" />}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{selected.description}</p>
          <div className="mt-4 rounded-xl bg-[var(--background)] p-3.5"><p className="text-xs font-bold">Reported by {selected.resident.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{selected.resident.email} · {selected.resident.residentProfile?.phone ?? "No phone provided"}</p><p className="mt-1 text-xs text-[var(--muted)]">{selected.resident.residentProfile?.address ?? selected.address}</p></div>
          <form onSubmit={updateReport} className="mt-4 space-y-3 border-t border-[var(--line)] pt-4"><label className="block space-y-1.5 text-xs font-bold">Update status<select name="status" defaultValue={selected.status} className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm"><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select></label><label className="block space-y-1.5 text-xs font-bold">Note for the resident<Textarea name="remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Share an update or next step…" maxLength={5000} className="min-h-20" /></label><Button loading={updating} type="submit" className="w-full">Save update & notify resident</Button></form>
        </div>
      </Card> : <Card className="flex min-h-80 flex-col items-center justify-center p-8 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[#0d9b91]"><MapPin /></div><h2 className="font-bold">Select a report</h2><p className="mt-1 max-w-xs text-sm text-[var(--muted)]">Open a report to view its location, resident details, and status controls.</p></Card>}</div>
    </div>
  </div>;
}
