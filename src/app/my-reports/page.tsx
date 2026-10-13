"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, StatusBadge } from "@/components/ui";

type Report = { id: string; title: string; description: string; address: string; barangay: string; status: string; remarks: string | null; createdAt: string; photoUrl: string | null };

export default function MyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let initialized = false;
    let priorStatuses = new Map<string, string>();
    const load = async () => {
      try {
        const response = await fetch("/api/reports");
        if (!active) return;
        if (response.status === 401) {
          setSignedIn(false);
          return;
        }
        if (!response.ok) throw new Error("Your reports could not be loaded.");
        const result = await response.json() as { reports: Report[] };
        if (!active) return;
        if (initialized) {
          for (const report of result.reports) {
            const previous = priorStatuses.get(report.id);
            if (previous && previous !== report.status) {
              toast.info(`“${report.title}” is now ${report.status.replace("_", " ").toLowerCase()}.`);
            }
          }
        }
        priorStatuses = new Map(result.reports.map((report) => [report.id, report.status]));
        initialized = true;
        setError("");
        setSignedIn(true);
        setReports(result.reports);
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : "Your reports could not be loaded.";
        setError(message);
        setSignedIn(true);
        if (!initialized) toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <Link href="/" className="text-sm font-semibold text-[var(--muted)] hover:text-[#0d9b91]">← Back to home</Link>
    <div className="mb-6 mt-5"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">Your community voice</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">My reports</h1><p className="mt-1 text-sm text-[var(--muted)]">Stay up to date on the concerns you have shared with the LGU.</p></div>
    {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-[var(--line)]" />)}</div> : signedIn === false ? <Card className="p-8 text-center"><h2 className="font-bold">Sign in to view your reports</h2><p className="mt-2 text-sm text-[var(--muted)]">Reports are private and only visible to you and authorized LGU staff.</p><Link href="/login" className="mt-4 inline-block"><Button>Sign in <ArrowRight size={16} /></Button></Link></Card> : error ? <Card className="p-8 text-center text-sm text-rose-600">{error}</Card> : reports.length === 0 ? <Card className="p-10 text-center"><ClipboardList className="mx-auto mb-3 text-[#0d9b91]" size={30} /><h2 className="font-bold">No reports yet</h2><p className="mt-2 text-sm text-[var(--muted)]">When you report a community concern, its progress will show here.</p><Link href="/map" className="mt-4 inline-block"><Button>Report a concern <ArrowRight size={16} /></Button></Link></Card> : <div className="space-y-4">{reports.map((report) => <Card key={report.id} className="overflow-hidden p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{report.title}</h2><StatusBadge status={report.status} /></div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{report.description}</p><p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]"><MapPin size={14} className="text-[#0d9b91]" />{report.address || report.barangay || "Tupi, South Cotabato"}</p><p className="mt-2 text-xs text-[var(--muted)]">Submitted {new Date(report.createdAt).toLocaleString("en-PH")}</p>{report.remarks && <div className="mt-4 rounded-xl bg-[var(--accent-soft)] p-3 text-sm"><span className="font-bold text-[#08776f]">LGU update: </span>{report.remarks}</div>}</div>{report.photoUrl && <img src={report.photoUrl} alt="Attached report" className="h-24 w-28 rounded-xl object-cover" />}</div></Card>)}</div>}
  </main>;
}
