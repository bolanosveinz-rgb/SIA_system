import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e4f4f4] via-[var(--background)] to-[var(--background)] px-4 py-8 dark:from-[#112a39]">
    <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-sm font-bold"><BrandLogo className="h-11 w-11 rounded-xl object-contain" />Serve<span className="text-[#0d9b91]">Link</span></Link>
    <div className="py-10"><AuthForm mode="resident-login" /></div>
    <p className="text-center text-xs text-[var(--muted)]">A community service platform for Tupi, South Cotabato</p>
  </main>;
}
