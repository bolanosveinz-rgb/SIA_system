import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e4f4f4] via-[var(--background)] to-[var(--background)] px-4 py-8 dark:from-[#112a39]">
    <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-sm font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12365a] text-lg text-white dark:bg-[#a8d1ff] dark:text-[#10253b]">S</span>Serve<span className="text-[#0d9b91]">Link</span></Link>
    <div className="py-8"><AuthForm mode="register" /></div>
    <p className="text-center text-xs text-[var(--muted)]">A community service platform for Tupi, South Cotabato</p>
  </main>;
}
