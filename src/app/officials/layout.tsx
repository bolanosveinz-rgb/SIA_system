"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";

type User = { name: string; email: string };

export default function OfficialsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (pathname === "/officials/login") return;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("Your officials account could not be loaded.");
        const data = await response.json();
        setUser(data.user);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Your officials account could not be loaded."));
  }, [pathname]);

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out could not be completed.");
      router.replace("/officials/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out could not be completed.");
    }
  }

  if (pathname === "/officials/login") return children;

  return <div className="min-h-screen bg-[var(--background)]">
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 shadow-[0_6px_24px_rgba(15,40,60,.045)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1500px] items-center gap-5 px-4 sm:px-6">
        <Link href="/officials" className="flex shrink-0 items-center gap-2.5">
          <BrandLogo className="h-10 w-10 rounded-xl object-contain" />
          <span className="text-base font-extrabold tracking-tight">Serve<span className="text-[#0d9b91]">Link</span><span className="ml-2 text-xs font-semibold text-[var(--muted)]">Officials</span></span>
        </Link>
        <Link href="/officials" aria-current={pathname === "/officials" ? "page" : undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent-soft)] px-3 text-sm font-semibold text-[#08776f] dark:text-[#70e3d6]"><Newspaper size={17} />News & updates</Link>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <span className="hidden min-w-0 text-right sm:block"><span className="block truncate text-xs font-bold">{user?.name ?? "Loading…"}</span><span className="block truncate text-[10px] text-[var(--muted)]">{user?.email}</span></span>
          <button type="button" onClick={() => void logout()} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-rose-600"><LogOut size={15} /><span className="hidden sm:inline">Sign out</span></button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
  </div>;
}
