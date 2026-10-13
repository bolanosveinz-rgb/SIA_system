"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPinned, Menu, Moon, Sun, X } from "lucide-react";

type User = { name: string; role: "ADMIN" | "RESIDENT" };

export function SiteHeader({ heatLink = true }: { heatLink?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("servelink-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
    fetch("/api/auth/me").then((r) => r.json()).then((data) => setUser(data.user)).catch(() => setUser(null));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("servelink-theme", next ? "dark" : "light");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ServeLink home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#12365a] text-white shadow-md shadow-blue-950/15 dark:bg-[#a8d1ff] dark:text-[#10253b]">
            <span className="text-xl font-bold">S</span>
          </span>
          <span><span className="block text-base font-extrabold tracking-tight">Serve<span className="text-[#0d9b91]">Link</span></span><span className="block text-[10px] font-medium tracking-[.12em] text-[var(--muted)] uppercase">Tupi, South Cotabato</span></span>
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {heatLink && <Link href="/map" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"><MapPinned size={17} className="text-[#0d9b91]" /> Heat map</Link>}
          {user?.role === "RESIDENT" && <Link href="/my-reports" className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--background)]">My reports</Link>}
          {user ? <><span className="mx-2 max-w-32 truncate text-sm text-[var(--muted)]">Hi, {user.name.split(" ")[0]}</span><button onClick={logout} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--background)]">Sign out</button></> : <><Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--foreground)]">Sign in</Link><Link href="/register" className="rounded-xl bg-[#12365a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d2945]">Create account</Link></>}
          <button onClick={toggleTheme} className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--background)]" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </nav>
        <div className="flex items-center gap-1 md:hidden">
          <button onClick={toggleTheme} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)]" aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--foreground)]" aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      {menuOpen && <nav className="absolute inset-x-0 top-full border-b border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl md:hidden">
        {heatLink && <Link href="/map" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center gap-2 rounded-lg px-3 font-semibold"><MapPinned size={18} className="text-[#0d9b91]" /> Heat map</Link>}
        {user?.role === "RESIDENT" && <Link href="/my-reports" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center px-3 font-semibold">My reports</Link>}
        {user ? <button onClick={logout} className="flex min-h-12 w-full items-center px-3 font-semibold">Sign out</button> : <div className="grid grid-cols-2 gap-2 pt-2"><Link href="/login" className="rounded-xl border border-[var(--line)] p-3 text-center font-semibold">Sign in</Link><Link href="/register" className="rounded-xl bg-[#12365a] p-3 text-center font-semibold text-white">Join ServeLink</Link></div>}
      </nav>}
    </header>
  );
}
