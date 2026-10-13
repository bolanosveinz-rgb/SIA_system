"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, FileText, LayoutDashboard, LogOut, Newspaper, Settings, Users, Menu } from "lucide-react";
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

  if (pathname === "/admin/login") return children;

  const sidebar = <div className="flex h-full flex-col">
    <Link href="/admin" className="flex h-[72px] items-center gap-3 border-b border-[var(--line)] px-5"><BrandLogo className="h-10 w-10 shrink-0 rounded-xl object-contain" /><span><span className="block font-extrabold">Serve<span className="text-[#0d9b91]">Link</span></span><span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--muted)]">LGU workspace</span></span></Link>
    <div className="px-4 pt-6"><p className="px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">Workspace</p><nav className="mt-2 space-y-1">{navigation.map(({ href, label, icon: Icon }) => {
      const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} onClick={() => setMobileNav(false)} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-[var(--accent-soft)] text-[#08776f] dark:text-[#70e3d6]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]")}><Icon size={18} />{label}{href === "/admin/reports" && unread > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}</Link>;
    })}</nav></div>
    <div className="mt-auto p-4"><div className="rounded-2xl bg-[var(--background)] p-3"><div className="flex items-center gap-3">{user?.profile?.profilePhotoUrl ? <img src={user.profile.profilePhotoUrl} alt={`${user.name}'s profile`} className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12365a] text-xs font-bold text-white dark:bg-[#a8d1ff] dark:text-[#10253b]">{user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("") ?? "LG"}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user?.name ?? "Loading…"}</span><span className="block truncate text-[10px] text-[var(--muted)]">{user?.email}</span></span></div><button onClick={() => void logout()} className="mt-3 flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600"><LogOut size={15} /> Sign out</button></div></div>
  </div>;

  return <div className="min-h-screen bg-[var(--background)]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] border-r border-[var(--line)] bg-[var(--surface)] lg:block">{sidebar}</aside>
    {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40" /><aside className="absolute inset-y-0 left-0 w-[275px] bg-[var(--surface)] shadow-2xl">{sidebar}</aside></div>}
    <div className="lg:pl-[252px]">
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/90 px-4 backdrop-blur-xl sm:px-7"><div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} aria-label="Open navigation" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)] lg:hidden"><Menu size={20} /></button>{user?.profile?.profilePhotoUrl && <img src={user.profile.profilePhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />}<div><p className="text-sm font-bold">Good day, {user?.name.split(" ")[0] ?? "Admin"}</p><p className="hidden text-[11px] text-[var(--muted)] sm:block">Municipality of Tupi · LGU portal</p></div></div><div className="flex items-center gap-2"><Link href="/admin/reports" onClick={() => { void fetch("/api/admin/notifications", { method: "PATCH" }); setUnread(0); }} aria-label={`${unread} unread notifications`} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--background)]"><Bell size={19} />{unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-rose-500" />}</Link><span className="hidden rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#08776f] sm:block">Tupi LGU</span></div></header>
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
