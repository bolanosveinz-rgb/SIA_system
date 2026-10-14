"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, HeartHandshake, MapPinned, MessageSquareText, ShieldCheck } from "lucide-react";
import { CommunityChatbot } from "@/components/community-chatbot";
import { NewsFeed } from "@/components/news-feed";

export default function HomePage() {
  return <>
    <main>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#e8f5f7] via-[#f7fafc] to-[var(--background)] dark:from-[#112a39] dark:via-[#0c1522] dark:to-[var(--background)]" />
        <div className="glass-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-400/10" />
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-16 text-center sm:px-6 sm:pb-16 sm:pt-24">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0d9b91]/20 bg-[var(--surface)]/75 px-3.5 py-2 text-xs font-semibold text-[#08776f] shadow-sm dark:text-[#70e3d6]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#0d9b91]" /> Your community, better connected</div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-[-.045em] sm:text-6xl">A better Tupi starts<br className="hidden sm:block" /> with <span className="bg-gradient-to-r from-[#0d9b91] to-[#3ab9a8] bg-clip-text text-transparent">being heard.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">Ask a question, share a concern, and stay close to the things happening in your community.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href="/map" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#12365a] px-5 text-sm font-bold text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#0d2945] sm:w-auto"><MapPinned size={18} /> Report a community concern <ArrowRight size={16} /></Link><Link href="/my-reports" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 text-sm font-bold transition hover:border-[#0d9b91]/40 sm:w-auto">Track my report <ChevronRight size={16} /></Link></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#0d9b91]">From your LGU</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Community news</h2><p className="mt-1 text-sm text-[var(--muted)]">Official updates and announcements from the Municipality of Tupi.</p></div><Link href="/map" className="inline-flex items-center gap-2 text-sm font-bold text-[#0d9b91] hover:underline">View community map <ArrowRight size={15} /></Link></div>
        <NewsFeed />
      </section>
      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6 sm:py-16">
          {[{ icon: MessageSquareText, title: "Speak up", body: "Share local concerns with a location pin and clear report details." }, { icon: ShieldCheck, title: "Stay informed", body: "Follow each report as it moves from pending to resolved." }, { icon: HeartHandshake, title: "Community first", body: "A simple, direct connection between residents and the LGU." }].map(({ icon: Icon, title, body }) => <div key={title} className="flex gap-4 rounded-2xl p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[#0d9b91]"><Icon size={20} /></span><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p></div></div>)}
        </div>
      </section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-28 pt-7 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>© {new Date().getFullYear()} ServeLink · Municipality of Tupi, South Cotabato</span><div className="flex gap-4"><Link href="/login" className="hover:text-[#0d9b91]">Resident sign in</Link><Link href="/admin/login" className="hover:text-[#0d9b91]">LGU portal <ChevronRight className="inline" size={12} /></Link><span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Built for the community</span></div></footer>
    <CommunityChatbot />
  </>;
}
