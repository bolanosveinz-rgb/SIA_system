"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, LayoutDashboard, LogOut, Newspaper, Settings, Users, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";

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
    setCollapsed(localStorage.getItem("servelink-admin-sidebar-collapsed") === "true");
    if (pathname === "/admin/login") return;
    const refreshUser = () => {
      fetch("/api/auth/me").then((r) => r.json()).then((data) => setUser(data.user)).catch(() => undefined);
    };
    refreshUser();
    window.addEventListener("servelink:profile-updated", refreshUser);
    return () => window.removeEventListener("servelink:profile-updated", refreshUser);
  }, [pathname]);

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

  const sidebar = <div className="flex h-full flex-col">
    <Link href="/admin" title={collapsed ? "ServeLink admin home" : undefined} className={`flex h-[72px] items-center gap-3 border-b border-[var(--line)] ${collapsed ? "justify-center px-2" : "px-5"}`}><BrandLogo className="h-12 w-12 shrink-0 rounded-xl object-contain" />{!collapsed && <span><span className="block font-extrabold">Serve<span className="text-[#0d9b91]">Link</span></span><span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--muted)]">LGU workspace</span></span>}</Link>
    <div className={`pt-6 ${collapsed ? "px-2" : "px-4"}`}>{!collapsed && <p className="px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">Workspace</p>}<nav aria-label="Admin navigation" className="mt-2 space-y-1">{navigation.map(({ href, label, icon: Icon }) => {
      const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} onClick={() => { setMobileNav(false); if (href === "/admin/reports") { void fetch("/api/admin/notifications", { method: "PATCH" }); setUnread(0); } }} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-xl text-sm font-semibold transition", collapsed ? "justify-center" : "gap-3 px-3", active ? "bg-[var(--accent-soft)] text-[#08776f] dark:text-[#70e3d6]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]")}><Icon size={18} />{!collapsed && label}{href === "/admin/reports" && unread > 0 && <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white", !collapsed && "ml-auto")}>{unread > 99 ? "99+" : unread}</span>}</Link>;
    })}</nav></div>
    <div className={`mt-auto space-y-3 ${collapsed ? "p-2" : "p-4"}`}><button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("flex min-h-10 w-full items-center rounded-xl text-sm font-semibold text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]", collapsed ? "justify-center" : "gap-3 px-3")}><Menu size={18} />{!collapsed && "Collapse menu"}</button><div className={cn("rounded-2xl bg-[var(--background)]", collapsed ? "flex flex-col items-center gap-2 p-2" : "p-3")}><div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>{user?.profile?.profilePhotoUrl ? <img src={user.profile.profilePhotoUrl} alt={`${user.name}'s profile`} className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#12365a] text-xs font-bold text-white dark:bg-[#a8d1ff] dark:text-[#10253b]">{user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("") ?? "LG"}</span>}{!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user?.name ?? "Loading…"}</span><span className="block truncate text-[10px] text-[var(--muted)]">{user?.email}</span></span>}</div><button onClick={() => void logout()} aria-label={collapsed ? "Sign out" : undefined} title={collapsed ? "Sign out" : undefined} className={cn("flex min-h-9 w-full items-center rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600", collapsed ? "justify-center" : "mt-3 gap-2 px-2")}><LogOut size={15} />{!collapsed && "Sign out"}</button></div></div>
  </div>;

  return <div className="min-h-screen bg-[var(--background)]">
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--line)] bg-[var(--surface)] transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-[252px]")}>{sidebar}</aside>
    {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40" /><aside className="absolute inset-y-0 left-0 w-[275px] bg-[var(--surface)] shadow-2xl">{sidebar}</aside></div>}
    <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]")}>
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/90 px-4 backdrop-blur-xl sm:px-7"><div className="flex items-center gap-3"><button onClick={() => { if (window.matchMedia("(min-width: 1024px)").matches) toggleSidebar(); else setMobileNav((open) => !open); }} aria-label={mobileNav ? "Close navigation" : collapsed ? "Expand admin sidebar" : "Open navigation"} aria-expanded={mobileNav || !collapsed} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)]">{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>{user?.profile?.profilePhotoUrl && <img src={user.profile.profilePhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />}<div><p className="text-sm font-bold">Good day, {user?.name.split(" ")[0] ?? "Admin"}</p><p className="hidden text-[11px] text-[var(--muted)] sm:block">Municipality of Tupi · LGU portal</p></div></div><span className="hidden rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#08776f] sm:block">Tupi LGU</span></header>
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
