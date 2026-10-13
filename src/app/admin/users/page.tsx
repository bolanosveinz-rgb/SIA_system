"use client";

import { useEffect, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, StatusBadge } from "@/components/ui";

type Resident = {
  id: string; name: string; email: string; createdAt: string; _count: { reports: number };
  residentProfile: { phone: string; barangay: string; address: string } | null;
};
type Detail = Omit<Resident, "_count"> & { reports: Array<{ id: string; title: string; status: string; createdAt: string }> };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Resident[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`).then(async (response) => {
        if (!response.ok) throw new Error("Residents could not be loaded.");
        const data = await response.json();
        setUsers(data.users);
        setPages(data.pages);
      }).catch((error) => toast.error(error instanceof Error ? error.message : "Residents could not be loaded."));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [page, search]);

  async function openResident(resident: Resident) {
    setLoadingDetail(true);
    setSelected({ ...resident, reports: [] });
    try {
      const response = await fetch(`/api/admin/users/${resident.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Resident profile could not be loaded.");
      setSelected(data.resident);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resident profile could not be loaded.");
    } finally {
      setLoadingDetail(false);
    }
  }

  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">The people of Tupi</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Residents</h1><p className="mt-1 text-sm text-[var(--muted)]">Search accounts and view resident-submitted reports.</p></div>
    <Card className="overflow-hidden"><div className="border-b border-[var(--line)] p-4"><div className="relative max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><Input aria-label="Search residents" placeholder="Search name, email, phone or barangay…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-9" /></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[var(--background)] text-xs text-[var(--muted)]"><tr><th className="px-5 py-3 font-semibold">Resident</th><th className="px-5 py-3 font-semibold">Contact</th><th className="px-5 py-3 font-semibold">Barangay</th><th className="px-5 py-3 font-semibold">Reports</th><th className="px-5 py-3 font-semibold">Registered</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-[var(--line)]">{users.map((resident) => <tr key={resident.id} className="hover:bg-[var(--background)]"><td className="px-5 py-4"><button onClick={() => void openResident(resident)} className="text-left font-bold hover:text-[#0d9b91]">{resident.name}</button><p className="mt-1 text-xs text-[var(--muted)]">{resident.email}</p></td><td className="px-5 py-4 text-[var(--muted)]">{resident.residentProfile?.phone ?? "—"}</td><td className="px-5 py-4">{resident.residentProfile?.barangay ?? "—"}</td><td className="px-5 py-4">{resident._count.reports}</td><td className="px-5 py-4 text-xs text-[var(--muted)]">{new Date(resident.createdAt).toLocaleDateString("en-PH")}</td><td className="px-5 py-4"><Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => void openResident(resident)}>View profile</Button></td></tr>)}</tbody></table></div>
      {!users.length && <div className="p-12 text-center text-sm text-[var(--muted)]">No residents found.</div>}
      <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--muted)]"><span>Page {page} of {pages}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="min-h-9 px-3 py-1 text-xs">Previous</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage((n) => n + 1)} className="min-h-9 px-3 py-1 text-xs">Next</Button></div></div>
    </Card>
    {selected && <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div role="dialog" aria-modal="true" aria-labelledby="resident-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex justify-between"><div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[#0d9b91]"><UserRound /></div><h2 id="resident-title" className="text-xl font-extrabold">{selected.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{selected.email}</p></div><button onClick={() => setSelected(null)} aria-label="Close resident details" className="h-10 rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--background)]"><X /></button></div><div className="mt-5 grid gap-3 rounded-2xl bg-[var(--background)] p-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-[var(--muted)]">Phone</p><p className="mt-1 font-semibold">{selected.residentProfile?.phone ?? "—"}</p></div><div><p className="text-xs text-[var(--muted)]">Barangay</p><p className="mt-1 font-semibold">{selected.residentProfile?.barangay ?? "—"}</p></div><div className="sm:col-span-2"><p className="text-xs text-[var(--muted)]">Address</p><p className="mt-1 font-semibold">{selected.residentProfile?.address ?? "—"}</p></div><div><p className="text-xs text-[var(--muted)]">Registered</p><p className="mt-1 font-semibold">{new Date(selected.createdAt).toLocaleDateString("en-PH")}</p></div></div><h3 className="mb-3 mt-6 font-bold">Submitted reports {loadingDetail && <span className="ml-2 text-xs font-normal text-[var(--muted)]">Loading…</span>}</h3>{selected.reports.length ? <div className="space-y-2">{selected.reports.map((report) => <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3"><div><p className="text-sm font-semibold">{report.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(report.createdAt).toLocaleDateString("en-PH")}</p></div><StatusBadge status={report.status} /></div>)}</div> : <p className="rounded-xl bg-[var(--background)] p-4 text-sm text-[var(--muted)]">{loadingDetail ? "Loading reports…" : "This resident has not submitted any reports."}</p>}</div></div>}
  </div>;
}
