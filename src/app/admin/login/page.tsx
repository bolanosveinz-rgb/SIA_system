import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function AdminLoginPage() {
  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e8f0f8] via-[var(--background)] to-[var(--background)] px-4 py-10 dark:from-[#132438]">
    <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-sm font-bold"><BrandLogo className="h-9 w-9 rounded-xl object-contain" />Serve<span className="text-[#0d9b91]">Link</span><span className="ml-1 rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0d9b91]">LGU</span></Link>
    <div className="py-12"><AuthForm mode="admin-login" /></div>
    <p className="text-center text-xs text-[var(--muted)]">Authorized Municipality of Tupi personnel only</p>
  </main>;
}
