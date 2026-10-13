"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, Home, LogOut, MapPinned, Menu, Moon, Settings, Sun, UserRound, X } from "lucide-react";
import { toast } from "sonner";
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
  const [authState, setAuthState] = useState<"loading" | "ready" | "error">("loading");
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("servelink-theme");
    setCollapsed(localStorage.getItem("servelink-resident-sidebar-collapsed") === "true");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
    const refreshUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) throw new Error("Your account details could not be loaded.");
        const data = await response.json();
        setUser(data.user);
        setAuthState("ready");
      } catch {
        setAuthState("error");
      }
    };
    const onProfileUpdated = () => void refreshUser();
    void refreshUser();
    window.addEventListener("servelink:profile-updated", onProfileUpdated);
    return () => window.removeEventListener("servelink:profile-updated", onProfileUpdated);
  }, []);

  useEffect(() => setMobileNav(false), [pathname]);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("servelink-resident-sidebar-collapsed", String(next));
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("servelink-theme", next ? "dark" : "light");
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("You could not be signed out. Please try again.");
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "You could not be signed out. Please try again.");
    }
  }

  const sidebar = <div className="flex h-full flex-col">
    <Link href="/" onClick={() => setMobileNav(false)} title={collapsed ? "ServeLink home" : undefined} className={cn("flex h-[72px] items-center gap-3 border-b border-[var(--line)]", collapsed ? "justify-center px-2" : "px-5")}>
      <BrandLogo className="h-12 w-12 shrink-0 rounded-xl object-contain" />
      {!collapsed && <span><span className="block font-extrabold">Serve<span className="text-[#0d9b91]">Link</span></span><span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--muted)]">Tupi community</span></span>}
    </Link>
    <div className={cn("pt-6", collapsed ? "px-2" : "px-4")}>
      {!collapsed && <p className="px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">Navigation</p>}
      <nav aria-label="Resident navigation" className="mt-2 space-y-1">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} onClick={() => setMobileNav(false)} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-xl text-sm font-semibold transition", collapsed ? "justify-center px-0" : "gap-3 px-3", active ? "bg-[var(--accent-soft)] text-[#08776f] dark:text-[#70e3d6]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]")}><Icon size={18} />{!collapsed && label}</Link>;
        })}
        {user?.role === "ADMIN" && <Link href="/admin" onClick={() => setMobileNav(false)} aria-label={collapsed ? "Admin portal" : undefined} title={collapsed ? "Admin portal" : undefined} className={cn("flex min-h-11 items-center rounded-xl text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]", collapsed ? "justify-center" : "gap-3 px-3")}><Settings size={18} />{!collapsed && "Admin portal"}</Link>}
      </nav>
    </div>
    <div className={cn("mt-auto space-y-3", collapsed ? "p-2" : "p-4")}>
      <button type="button" onClick={toggleSidebar} className={cn("flex min-h-10 w-full items-center rounded-xl text-sm font-semibold text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]", collapsed ? "justify-center" : "gap-3 px-3")} aria-label={collapsed ? "Expand resident sidebar" : "Collapse resident sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}><Menu size={18} />{!collapsed && "Collapse menu"}</button>
      <button type="button" onClick={toggleTheme} className={cn("flex min-h-10 w-full items-center rounded-xl text-sm font-semibold text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]", collapsed ? "justify-center" : "gap-3 px-3")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={collapsed ? (dark ? "Light theme" : "Dark theme") : undefined}>{dark ? <Sun size={18} /> : <Moon size={18} />}{!collapsed && (dark ? "Light theme" : "Dark theme")}</button>
      {authState === "loading" && <div aria-label="Loading account" className={cn("animate-pulse rounded-2xl bg-[var(--background)]", collapsed ? "mx-auto h-10 w-10" : "h-16")} />}
      {authState === "error" && <button onClick={() => window.location.reload()} aria-label="Retry loading account" title="Retry loading account" className={cn("flex min-h-10 w-full items-center justify-center rounded-xl text-xs font-semibold text-amber-700 hover:bg-[var(--background)]", !collapsed && "px-2")}>{collapsed ? <UserRound size={18} /> : "Account unavailable · Retry"}</button>}
      {authState === "ready" && user && <div className={cn("rounded-2xl bg-[var(--background)]", collapsed ? "flex flex-col items-center gap-2 p-2" : "p-3")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          {user.profile?.profilePhotoUrl ? <img src={user.profile.profilePhotoUrl} alt={`${user.name}'s profile`} className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[#08776f]">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>}
          {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user.name}</span><span className="block truncate text-[10px] text-[var(--muted)]">{user.email}</span></span>}
        </div>
        <button onClick={() => void logout()} aria-label={collapsed ? "Sign out" : undefined} title={collapsed ? "Sign out" : undefined} className={cn("flex min-h-9 w-full items-center rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600", collapsed ? "justify-center" : "mt-3 gap-2 px-2")}><LogOut size={15} />{!collapsed && "Sign out"}</button>
      </div>}
      {authState === "ready" && !user && <div className={cn(collapsed ? "space-y-2" : "grid grid-cols-2 gap-2")}>
        <Link href="/login" onClick={() => setMobileNav(false)} aria-label={collapsed ? "Sign in" : undefined} title={collapsed ? "Sign in" : undefined} className={cn("rounded-xl border border-[var(--line)] text-center text-sm font-semibold", collapsed ? "flex min-h-10 items-center justify-center" : "p-3")}>{collapsed ? <UserRound size={18} /> : "Sign in"}</Link>
        <Link href="/register" onClick={() => setMobileNav(false)} aria-label={collapsed ? "Join ServeLink" : undefined} title={collapsed ? "Join ServeLink" : undefined} className={cn("rounded-xl bg-[#12365a] text-center text-sm font-semibold text-white", collapsed ? "flex min-h-10 items-center justify-center" : "p-3")}>{collapsed ? "+" : "Join ServeLink"}</Link>
      </div>}
    </div>
  </div>;

  return <div className="min-h-screen bg-[var(--background)]">
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--line)] bg-[var(--surface)] transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-64")}>{sidebar}</aside>
    {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40" /><aside className="absolute inset-y-0 left-0 w-[275px] bg-[var(--surface)] shadow-2xl">{sidebar}</aside></div>}
    <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/90 px-4 backdrop-blur-xl">
        <button onClick={() => { if (window.matchMedia("(min-width: 1024px)").matches) toggleSidebar(); else setMobileNav((open) => !open); }} aria-label={mobileNav ? "Close navigation" : collapsed ? "Expand resident sidebar" : "Open navigation"} aria-expanded={mobileNav || !collapsed} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)]">{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
        <Link href="/" className="flex items-center gap-2 font-extrabold lg:hidden">Serve<span className="text-[#0d9b91]">Link</span></Link>
        <span className="w-9 lg:hidden" aria-hidden="true" />
      </header>
      {children}
    </div>
  </div>;
}
