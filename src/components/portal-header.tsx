"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui";

type PortalRole = "ADMIN" | "RESIDENT";
type Notification = {
  id: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  type: string;
  report: { id: string; title: string } | null;
};

type Props = {
  role: PortalRole;
  isAuthenticated?: boolean;
  name: string;
  email: string;
  profilePhotoUrl?: string | null;
  collapsed: boolean;
  onToggleSidebar: () => void;
};

function pageTitle(pathname: string, role: PortalRole) {
  if (role === "ADMIN") {
    if (pathname === "/admin") return ["Overview", "Municipality workspace"];
    if (pathname.startsWith("/admin/reports")) return ["Reports", "Review and follow up on resident concerns"];
    if (pathname.startsWith("/admin/users")) return ["Residents", "Resident directory and account details"];
    if (pathname.startsWith("/admin/news")) return ["News & updates", "Community announcements"];
    if (pathname.startsWith("/admin/settings")) return ["Settings", "Manage your LGU profile"];
    return ["Admin portal", "Municipality of Tupi"];
  }
  if (pathname === "/") return ["Community home", "Your community, better connected"];
  if (pathname.startsWith("/map")) return ["Community map", "Explore reports or share a concern"];
  if (pathname.startsWith("/my-reports")) return ["My reports", "Follow your community concerns"];
  if (pathname.startsWith("/profile")) return ["My profile", "Manage your resident account"];
  return ["ServeLink", "Municipality of Tupi"];
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function PortalHeader({ role, isAuthenticated = true, name, email, profilePhotoUrl, collapsed, onToggleSidebar }: Props) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [loadError, setLoadError] = useState("");
  const notificationBox = useRef<HTMLDivElement>(null);
  const title = pageTitle(pathname, role);
  const notificationUrl = role === "ADMIN" ? "/api/admin/notifications" : "/api/resident/notifications";
  const reportUrl = role === "ADMIN" ? "/admin/reports" : "/my-reports";

  useEffect(() => {
    const saved = localStorage.getItem("servelink-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    let hasShownError = false;
    const refreshCount = async () => {
      try {
        const response = await fetch(notificationUrl);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Notifications could not be loaded.");
        if (active) {
          setUnread(result.unread);
          if (open) setNotifications(result.notifications);
          hasShownError = false;
        }
      } catch (error) {
        if (!hasShownError && active) {
          hasShownError = true;
          toast.error(error instanceof Error ? error.message : "Notifications could not be loaded.");
        }
      }
    };
    void refreshCount();
    const timer = window.setInterval(() => void refreshCount(), 45000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, notificationUrl, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !notificationBox.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function loadNotifications() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(notificationUrl);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Notifications could not be loaded.");
      setNotifications(result.notifications);
      setUnread(result.unread);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Notifications could not be loaded.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    setMarkingRead(true);
    try {
      const response = await fetch(notificationUrl, { method: "PATCH" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Notifications could not be marked as read.");
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notifications could not be marked as read.");
    } finally {
      setMarkingRead(false);
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("servelink-theme", next ? "dark" : "light");
  }

  function notificationHref(notification: Notification) {
    if (role === "ADMIN") return notification.report ? `/admin/reports?reportId=${encodeURIComponent(notification.report.id)}` : "/admin/reports";
    return notification.report ? `/my-reports?reportId=${encodeURIComponent(notification.report.id)}` : "/my-reports";
  }

  return <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/90 shadow-[0_4px_20px_rgba(15,40,60,.04)] backdrop-blur-xl">
    <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6">
      <button type="button" onClick={onToggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] transition hover:border-[#0d9b91]/30 hover:bg-[var(--accent-soft)] hover:text-[#08776f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9b91]">
        <Menu size={19} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-extrabold tracking-tight sm:text-lg">{title[0]}</p>
        <p className="hidden truncate text-xs text-[var(--muted)] sm:block">{title[1]}</p>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9b91]">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative" ref={notificationBox}>
          <button type="button" onClick={() => { const next = !open; setOpen(next); if (next) void loadNotifications(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9b91]">
            <Bell size={19} />
            {unread > 0 && <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--surface)] bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">{unread > 99 ? "99+" : unread}</span>}
          </button>
          {open && <section aria-label="Notifications" className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_20px_60px_rgba(15,40,60,.18)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
              <div><h2 className="text-sm font-bold">Notifications</h2><p className="mt-0.5 text-[11px] text-[var(--muted)]">{unread ? `${unread} unread` : "You’re all caught up"}</p></div>
              <div className="flex items-center gap-1">
                {unread > 0 && <button type="button" onClick={() => void markAllRead()} disabled={markingRead} aria-label="Mark all notifications as read" title="Mark all as read" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0d9b91] hover:bg-[var(--accent-soft)] disabled:opacity-50"><CheckCheck size={17} /></button>}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--background)]"><X size={17} /></button>
              </div>
            </div>
            <div className="max-h-[min(28rem,65vh)] overflow-y-auto">
              {loading && !notifications.length ? <div className="space-y-3 p-4"><div className="h-3 w-2/3 animate-pulse rounded bg-[var(--line)]" /><div className="h-10 animate-pulse rounded-xl bg-[var(--background)]" /><div className="h-10 animate-pulse rounded-xl bg-[var(--background)]" /></div>
                : loadError ? <div className="p-5 text-center"><p className="text-sm text-rose-600">{loadError}</p><button type="button" onClick={() => void loadNotifications()} className="mt-2 text-xs font-bold text-[#0d9b91] hover:underline">Try again</button></div>
                  : notifications.length ? <ul className="divide-y divide-[var(--line)]">{notifications.map((notification) => <li key={notification.id}><Link href={notificationHref(notification)} onClick={() => setOpen(false)} className={cn("block px-4 py-3.5 transition hover:bg-[var(--background)]", !notification.readAt && "bg-[var(--accent-soft)]/45")}><div className="flex gap-3"><span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notification.readAt ? "bg-[var(--line)]" : "bg-[#0d9b91]")} /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-5">{notification.message}</span><span className="mt-1 block text-[10px] text-[var(--muted)]">{timeLabel(notification.createdAt)}</span></span><ChevronDown size={14} className="-rotate-90 self-center text-[var(--muted)]" /></div></Link></li>)}</ul>
                    : <div className="px-5 py-10 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[#0d9b91]"><Bell size={19} /></span><p className="mt-3 text-sm font-semibold">No notifications yet</p><p className="mt-1 text-xs text-[var(--muted)]">Updates about your reports will appear here.</p></div>}
            </div>
            <Link href={reportUrl} onClick={() => setOpen(false)} className="block border-t border-[var(--line)] px-4 py-3 text-center text-xs font-bold text-[#0d9b91] transition hover:bg-[var(--background)]">{role === "ADMIN" ? "Go to reports" : "View my reports"}</Link>
          </section>}
        </div>
        <div className="ml-1 hidden min-w-0 items-center gap-2.5 border-l border-[var(--line)] pl-3 sm:flex">
          {profilePhotoUrl ? <img src={profilePhotoUrl} alt={`${name}'s profile`} className="h-9 w-9 rounded-full object-cover ring-2 ring-[var(--accent-soft)]" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[#08776f]">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>}
          <span className="hidden max-w-36 min-w-0 md:block"><span className="block truncate text-xs font-bold">{name}</span><span className="block truncate text-[10px] text-[var(--muted)]">{email}</span></span>
        </div>
      </div>
    </div>
  </header>;
}
