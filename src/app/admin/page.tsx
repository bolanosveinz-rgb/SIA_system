"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, Clock3, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { CommunityMap } from "@/components/community-map";
import { Card, StatusBadge } from "@/components/ui";

type Report = { id: string; title: string; status: string; createdAt: string; lat: number; lng: number; resident: { name: string } };
type Dashboard = { stats: { residents: number; reports: number; pending: number; resolved: number }; recentReports: Report[] };

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [summary, all] = await Promise.all([fetch("/api/admin/summary"), fetch("/api/reports")]);
        if (!summary.ok || !all.ok) throw new Error("Dashboard data could not be loaded.");
        const [stats, reportData] = await Promise.all([summary.json(), all.json()]);
        if (active) { setData(stats); setReports(reportData.reports); }
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Dashboard data could not be loaded.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const stats = data?.stats;
  const cards = [
    { label: "Total residents", value: stats?.residents, icon: Users, tone: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200" },
    { label: "Total reports", value: stats?.reports, icon: FileText, tone: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200" },
    { label: "Pending review", value: stats?.pending, icon: Clock3, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200" },
    { label: "Resolved", value: stats?.resolved, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" },
  ];
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">At a glance</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">LGU dashboard</h1><p className="mt-1 text-sm text-[var(--muted)]">A live view of the reports and residents you serve.</p></div><span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live updates</span></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, tone }) => <Card key={label} className="p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[var(--muted)] sm:text-sm">{label}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span></div><p className="mt-4 text-3xl font-extrabold tracking-tight">{value === undefined ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-[var(--line)]" /> : value.toLocaleString()}</p><p className="mt-1 text-[10px] text-[var(--muted)]">Municipality of Tupi</p></Card>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between p-4 sm:p-5"><div><h2 className="font-bold">Community reports map</h2><p className="mt-1 text-xs text-[var(--muted)]">Report density and individual locations</p></div><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0d9b91]"><Activity size={14} /> Live map</span></div><div className="px-3 pb-3 sm:px-4"><CommunityMap reports={reports} height="450px" /></div></Card>
      <Card className="p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Recent reports</h2><p className="mt-1 text-xs text-[var(--muted)]">The latest from your community</p></div><Link href="/admin/reports" className="rounded-lg p-2 text-[#0d9b91] hover:bg-[var(--accent-soft)]" aria-label="View all reports"><ArrowRight size={17} /></Link></div>{data?.recentReports.length ? <div className="divide-y divide-[var(--line)]">{data.recentReports.map((report) => <Link key={report.id} href="/admin/reports" className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{report.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{report.resident.name} · {new Date(report.createdAt).toLocaleDateString("en-PH")}</p></div><StatusBadge status={report.status} /></Link>)}</div> : <div className="py-12 text-center text-sm text-[var(--muted)]">No reports have been submitted yet.</div>}</Card>
    </div>
  </div>;
}
