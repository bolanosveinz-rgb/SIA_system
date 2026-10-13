"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, Home, LogOut, MapPinned, Menu, Moon, Settings, Sun, UserRound, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/components/ui";

type User = {
  name: string;
  email: string;
  role: "ADMIN" | "RESIDENT";
  profile?: { profilePhotoUrl?: string | null } | null;
};

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/map", label: "Community map", icon: MapPinned },
  { href: "/my-reports", label: "My reports", icon: ClipboardList },
  { href: "/profile", label: "My profile", icon: UserRound },
];

export function ResidentSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("servelink-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
    const refreshUser = () => {
      fetch("/api/auth/me").then((response) => response.json()).then((data) => setUser(data.user)).catch(() => setUser(null));
    };
    refreshUser();
    window.addEventListener("servelink:profile-updated", refreshUser);
    return () => window.removeEventListener("servelink:profile-updated", refreshUser);
  }, []);

  useEffect(() => setMobileNav(false), [pathname]);

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

  const sidebar = <div className="flex h-full flex-col">
    <Link href="/" onClick={() => setMobileNav(false)} className="flex h-[72px] items-center gap-3 border-b border-[var(--line)] px-5">
      <BrandLogo className="h-12 w-12 shrink-0 rounded-xl object-contain" />
      <span><span className="block font-extrabold">Serve<span className="text-[#0d9b91]">Link</span></span><span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--muted)]">Tupi community</span></span>
    </Link>
    <div className="px-4 pt-6">
      <p className="px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">Navigation</p>
      <nav aria-label="Resident navigation" className="mt-2 space-y-1">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} onClick={() => setMobileNav(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-[var(--accent-soft)] text-[#08776f] dark:text-[#70e3d6]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]")}><Icon size={18} />{label}</Link>;
        })}
        {user?.role === "ADMIN" && <Link href="/admin" onClick={() => setMobileNav(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"><Settings size={18} />Admin portal</Link>}
      </nav>
    </div>
    <div className="mt-auto space-y-3 p-4">
      <button type="button" onClick={toggleTheme} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>{dark ? <Sun size={18} /> : <Moon size={18} />}{dark ? "Light theme" : "Dark theme"}</button>
      {user ? <div className="rounded-2xl bg-[var(--background)] p-3">
        <div className="flex items-center gap-3">
          {user.profile?.profilePhotoUrl ? <img src={user.profile.profilePhotoUrl} alt={`${user.name}'s profile`} className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[#08776f]">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>}
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user.name}</span><span className="block truncate text-[10px] text-[var(--muted)]">{user.email}</span></span>
        </div>
        <button onClick={() => void logout()} className="mt-3 flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600"><LogOut size={15} />Sign out</button>
      </div> : <div className="grid grid-cols-2 gap-2">
        <Link href="/login" onClick={() => setMobileNav(false)} className="rounded-xl border border-[var(--line)] p-3 text-center text-sm font-semibold">Sign in</Link>
        <Link href="/register" onClick={() => setMobileNav(false)} className="rounded-xl bg-[#12365a] p-3 text-center text-sm font-semibold text-white">Join ServeLink</Link>
      </div>}
    </div>
  </div>;

  return <div className="min-h-screen bg-[var(--background)]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[var(--line)] bg-[var(--surface)] lg:block">{sidebar}</aside>
    {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40" /><aside className="absolute inset-y-0 left-0 w-[275px] bg-[var(--surface)] shadow-2xl">{sidebar}</aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/90 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setMobileNav((open) => !open)} aria-label={mobileNav ? "Close navigation" : "Open navigation"} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)]">{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
        <Link href="/" className="flex items-center gap-2 font-extrabold">Serve<span className="text-[#0d9b91]">Link</span></Link>
        <span className="w-9" aria-hidden="true" />
      </header>
      {children}
    </div>
  </div>;
}
