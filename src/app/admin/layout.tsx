"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, LayoutDashboard, LogOut, Newspaper, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { PortalHeader } from "@/components/portal-header";

const navigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/users", label: "Residents", icon: Users },
  { href: "/admin/news", label: "News & updates", icon: Newspaper },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

type NotificationItem = { id: string; message: string; createdAt: string; type: string };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; profile?: { profilePhotoUrl?: string | null } | null } | null>(null);
  const [unread, setUnread] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    const refreshUser = () => {
      fetch("/api/auth/me").then((r) => r.json()).then((data) => setUser(data.user)).catch(() => undefined);
    };
    refreshUser();
    window.addEventListener("servelink:profile-updated", refreshUser);
    return () => window.removeEventListener("servelink:profile-updated", refreshUser);
  }, [pathname]);

  useEffect(() => {
    setCollapsed(localStorage.getItem("servelink-admin-sidebar-collapsed") === "true");
  }, []);

  useEffect(() => setMobileNav(false), [pathname]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    const seen = new Set<string>();
    let initializing = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/admin/notifications");
        if (!response.ok) return;
        const data = await response.json();
        setUnread(data.unread);
        const notifications = data.notifications as NotificationItem[];
        if (initializing) {
          notifications.forEach((item) => seen.add(item.id));
          initializing = false;
          return;
        }
        for (const item of [...notifications].reverse()) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          if (item.type === "NEW_REPORT") toast.info(item.message, { duration: 7000, action: { label: "View reports", onClick: () => router.push("/admin/reports") } });
        }
        if (seen.size > 250) {
          seen.clear();
          for (const notification of notifications) seen.add(notification.id);
        }
      } catch {
        toast.error("Live notifications are temporarily unavailable.");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 12000);
    return () => window.clearInterval(timer);
  }, [pathname, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("servelink-admin-sidebar-collapsed", String(next));
  }

  if (pathname === "/admin/login") return children;

  const compactSidebar = collapsed && !mobileNav;
  const sidebar = <div className="flex h-full flex-col">
    <div className={cn("flex h-[72px] shrink-0 items-center border-b border-[var(--line)]", compactSidebar ? "justify-center gap-0.5 px-1" : "gap-2 px-4")}>
      <Link href="/admin" title={compactSidebar ? "ServeLink admin home" : undefined} className={cn("flex min-w-0 items-center gap-3", compactSidebar ? "justify-center" : "flex-1")}><BrandLogo className={cn("shrink-0 rounded-xl object-contain", compactSidebar ? "h-9 w-9" : "h-12 w-12")} />{!compactSidebar && <span className="min-w-0"><span className="block font-extrabold">Serve<span className="text-[#0d9b91]">Link</span></span><span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--muted)]">LGU workspace</span></span>}</Link>
      <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("hidden shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[#08776f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9b91] lg:flex", compactSidebar ? "h-7 w-7" : "h-9 w-9")}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
    <div className={`pt-6 ${compactSidebar ? "px-2" : "px-4"}`}>{!compactSidebar && <p className="px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">Workspace</p>}<nav aria-label="Admin navigation" className="mt-2 space-y-1">{navigation.map(({ href, label, icon: Icon }) => {
      const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} onClick={() => setMobileNav(false)} aria-label={compactSidebar ? label : undefined} title={compactSidebar ? label : undefined} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-xl text-sm font-semibold transition", compactSidebar ? "justify-center" : "gap-3 px-3", active ? "bg-[var(--accent-soft)] text-[#08776f] dark:text-[#70e3d6]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]")}><Icon size={18} />{!compactSidebar && label}{href === "/admin/reports" && unread > 0 && <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white", !compactSidebar && "ml-auto")}>{unread > 99 ? "99+" : unread}</span>}</Link>;
    })}</nav></div>
    <div className={`mt-auto ${compactSidebar ? "p-2" : "p-4"}`}><div className={cn("rounded-2xl bg-[var(--background)]", compactSidebar ? "flex flex-col items-center gap-2 p-2" : "p-3")}><div className={cn("flex items-center", compactSidebar ? "justify-center" : "gap-3")}>{user?.profile?.profilePhotoUrl ? <img src={user.profile.profilePhotoUrl} alt={`${user.name}'s profile`} className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#12365a] text-xs font-bold text-white dark:bg-[#a8d1ff] dark:text-[#10253b]">{user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("") ?? "LG"}</span>}{!compactSidebar && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user?.name ?? "Loading…"}</span><span className="block truncate text-[10px] text-[var(--muted)]">{user?.email}</span></span>}</div><button onClick={() => void logout()} aria-label={compactSidebar ? "Sign out" : undefined} title={compactSidebar ? "Sign out" : undefined} className={cn("flex min-h-9 w-full items-center rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600", compactSidebar ? "justify-center" : "mt-3 gap-2 px-2")}><LogOut size={15} />{!compactSidebar && "Sign out"}</button></div></div>
  </div>;

  return <div className="min-h-screen bg-[var(--background)]">
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--line)] bg-[var(--surface)] transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-[252px]")}>{sidebar}</aside>
    {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40" /><aside className="absolute inset-y-0 left-0 w-[275px] bg-[var(--surface)] shadow-2xl">{sidebar}</aside></div>}
    <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]")}>
      <PortalHeader role="ADMIN" name={user?.name ?? "Administrator"} email={user?.email ?? ""} profilePhotoUrl={user?.profile?.profilePhotoUrl} mobileNavOpen={mobileNav} onToggleSidebar={() => setMobileNav((open) => !open)} />
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
