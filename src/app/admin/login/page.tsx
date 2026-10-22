import Link from "next/link";
import { BadgeCheck, Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function AdminLoginPage() {
  return <main className="min-h-screen bg-[#f5f8fb] p-3 dark:bg-[#0b1421] sm:p-5 lg:p-7">
    <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1440px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_32px_100px_rgba(18,54,90,.14)] dark:border-slate-700 dark:bg-[var(--surface)] lg:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[1.02fr_.98fr]">
      <section className="relative hidden overflow-hidden bg-[#102e4d] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(199,168,99,.24),transparent_42%),radial-gradient(ellipse_at_85%_90%,rgba(67,128,207,.22),transparent_45%)]" />
        <div className="absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full border border-white/10" />
        <div className="absolute -right-16 top-[31%] h-[22rem] w-[22rem] rounded-full border border-white/10" />
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <BrandLogo className="h-12 w-12 rounded-xl object-contain ring-1 ring-white/25" />
            <span className="text-lg font-extrabold tracking-tight">Serve<span className="text-[#73e1d5]">Link</span><span className="ml-2 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-white/80">LGU</span></span>
          </Link>
        </div>
        <div className="relative z-10 max-w-xl pb-8">
          <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#73e1d5]"><Building2 size={23} /></span>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#83e3da]">Municipality of Tupi</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.12] tracking-tight xl:text-5xl">A clearer view of the community you serve.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-blue-100/75">A secure workspace for managing reports, sharing official updates, and staying connected with Tupi residents.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            {[{ icon: ShieldCheck, label: "Protected access" }, { icon: BadgeCheck, label: "Authorized staff" }].map(({ icon: Icon, label }) => <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3.5 py-2 text-xs font-semibold text-white/85"><Icon size={15} className="text-[#83e3da]" />{label}</span>)}
          </div>
        </div>
        <p className="relative z-10 text-xs text-blue-100/55">ServeLink · Municipality of Tupi, South Cotabato</p>
      </section>

      <section className="flex min-w-0 flex-col justify-between px-5 py-6 sm:px-10 sm:py-9 lg:px-10 xl:px-16 xl:py-12">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[#0d9b91] lg:hidden"><BrandLogo className="h-8 w-8 rounded-lg object-contain" />ServeLink</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"><LockKeyhole size={13} /> Secure administrator portal</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10 lg:py-4">
          <AuthForm mode="admin-login" />
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-center text-[11px] text-[var(--muted)] sm:flex-row sm:text-left">
          <span>Authorized Municipality of Tupi personnel only</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-[#0d9b91]" /> Secure LGU access</span>
        </div>
      </section>
    </div>
  </main>;
}
