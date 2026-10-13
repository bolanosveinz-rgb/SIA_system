"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Home, LogOut, MapPinned, UserRound } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { PortalHeader } from "@/components/portal-header";
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

  useEffect(() => {
    setCollapsed(localStorage.getItem("servelink-resident-sidebar-collapsed") === "true");
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

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("You could not be signed out. Please try again.");
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "You could not be signed out. Please try again.");
    }
  }

  const compactSidebar = collapsed && !mobileNav;
  const sidebar = <div className="flex h-full flex-col">
    <div className={cn("flex h-[72px] shrink-0 items-center border-b border-[var(--line)]", compactSidebar ? "justify-center gap-0.5 px-1" : "gap-2 px-4")}>
      <Link href="/" onClick={() => setMobileNav(false)} title={compactSidebar ? "ServeLink home" : undefined} className={cn("flex min-w-0 items-center gap-3", compactSidebar ? "justify-center" : "flex-1")}>
        <BrandLogo className={cn("shrink-0 rounded-xl object-contain", compactSidebar ? "h-9 w-9" : "h-12 w-12")} />
        {!compactSidebar && <span className="min-w-0"><span className="block font-extrabold">Serve<span className="text-[#0d9b91]">Link</span></span><span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--muted)]">Tupi community</span></span>}
      </Link>
      <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand resident sidebar" : "Collapse resident sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("hidden shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[#08776f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9b91] lg:flex", compactSidebar ? "h-7 w-7" : "h-9 w-9")}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
    <div className={cn("pt-6", compactSidebar ? "px-2" : "px-4")}>
      {!compactSidebar && <p className="px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">Navigation</p>}
      <nav aria-label="Resident navigation" className="mt-2 space-y-1">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} onClick={() => setMobileNav(false)} aria-label={compactSidebar ? label : undefined} title={compactSidebar ? label : undefined} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-xl text-sm font-semibold transition", compactSidebar ? "justify-center px-0" : "gap-3 px-3", active ? "bg-[var(--accent-soft)] text-[#08776f] dark:text-[#70e3d6]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]")}><Icon size={18} />{!compactSidebar && label}</Link>;
        })}
      </nav>
    </div>
    <div className={cn("mt-auto", compactSidebar ? "p-2" : "p-4")}>
      {authState === "loading" && <div aria-label="Loading account" className={cn("animate-pulse rounded-2xl bg-[var(--background)]", compactSidebar ? "mx-auto h-10 w-10" : "h-16")} />}
      {authState === "error" && <button onClick={() => window.location.reload()} aria-label="Retry loading account" title="Retry loading account" className={cn("flex min-h-10 w-full items-center justify-center rounded-xl text-xs font-semibold text-amber-700 hover:bg-[var(--background)]", !compactSidebar && "px-2")}>{compactSidebar ? <UserRound size={18} /> : "Account unavailable · Retry"}</button>}
      {authState === "ready" && user && <div className={cn("rounded-2xl bg-[var(--background)]", compactSidebar ? "flex flex-col items-center gap-2 p-2" : "p-3")}>
        <div className={cn("flex items-center", compactSidebar ? "justify-center" : "gap-3")}>
          {user.profile?.profilePhotoUrl ? <img src={user.profile.profilePhotoUrl} alt={`${user.name}'s profile`} className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[#08776f]">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>}
          {!compactSidebar && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user.name}</span><span className="block truncate text-[10px] text-[var(--muted)]">{user.email}</span></span>}
        </div>
        <button onClick={() => void logout()} aria-label={compactSidebar ? "Sign out" : undefined} title={compactSidebar ? "Sign out" : undefined} className={cn("flex min-h-9 w-full items-center rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600", compactSidebar ? "justify-center" : "mt-3 gap-2 px-2")}><LogOut size={15} />{!compactSidebar && "Sign out"}</button>
      </div>}
      {authState === "ready" && !user && <div className={cn(compactSidebar ? "space-y-2" : "grid grid-cols-2 gap-2")}>
        <Link href="/login" onClick={() => setMobileNav(false)} aria-label={compactSidebar ? "Sign in" : undefined} title={compactSidebar ? "Sign in" : undefined} className={cn("rounded-xl border border-[var(--line)] text-center text-sm font-semibold", compactSidebar ? "flex min-h-10 items-center justify-center" : "p-3")}>{compactSidebar ? <UserRound size={18} /> : "Sign in"}</Link>
        <Link href="/register" onClick={() => setMobileNav(false)} aria-label={compactSidebar ? "Join ServeLink" : undefined} title={compactSidebar ? "Join ServeLink" : undefined} className={cn("rounded-xl bg-[#12365a] text-center text-sm font-semibold text-white", compactSidebar ? "flex min-h-10 items-center justify-center" : "p-3")}>{compactSidebar ? "+" : "Join ServeLink"}</Link>
      </div>}
    </div>
  </div>;

  return <div className="min-h-screen bg-[var(--background)]">
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--line)] bg-[var(--surface)] transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-64")}>{sidebar}</aside>
    {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40" /><aside className="absolute inset-y-0 left-0 w-[275px] bg-[var(--surface)] shadow-2xl">{sidebar}</aside></div>}
    <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
    <PortalHeader role="RESIDENT" isAuthenticated={authState === "ready" && user?.role === "RESIDENT"} name={user?.name ?? "Resident"} email={user?.email ?? ""} profilePhotoUrl={user?.profile?.profilePhotoUrl} mobileNavOpen={mobileNav} onToggleSidebar={() => setMobileNav((open) => !open)} />
      {children}
    </div>
  </div>;
}
