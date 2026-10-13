"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BARANGAYS } from "@/lib/places";
import { Button, Input } from "@/components/ui";

type Props = { mode: "register" | "resident-login" | "admin-login" };

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const isRegister = mode === "register";
  const isAdmin = mode === "admin-login";
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (isRegister && values.password !== values.confirmPassword) {
      setError("Your passwords do not match.");
      setLoading(false);
      return;
    }
    const payload = isRegister ? {
      name: values.name,
      email: values.email,
      phone: values.phone,
      barangay: values.barangay,
      address: values.address,
      password: values.password,
    } : {
      identifier: isAdmin ? values.email : values.identifier,
      password: values.password,
    };
    try {
      const response = await fetch(`/api/auth/${isRegister ? "register" : isAdmin ? "admin-login" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in. Please try again.");
      toast.success(isRegister ? "Welcome to ServeLink!" : "You’re signed in.");
      router.push(isAdmin ? "/admin" : "/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[460px]">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#12365a] text-white shadow-lg shadow-blue-950/15 dark:bg-[#a8d1ff] dark:text-[#10253b]">
          {isAdmin ? <Landmark size={25} /> : <span className="text-2xl font-extrabold">S</span>}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{isRegister ? "Join your community" : isAdmin ? "LGU sign in" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{isRegister ? "Create an account to connect with your local government." : isAdmin ? "Secure access for authorized LGU administrators." : "Sign in to stay connected with Tupi."}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_60px_rgba(24,53,84,.08)] sm:p-8">
        {isRegister && <>
          <label className="block space-y-1.5 text-sm font-semibold">Full name<Input autoComplete="name" name="name" placeholder="Juan Dela Cruz" required minLength={2} maxLength={120} /></label>
        </>}
        <label className="block space-y-1.5 text-sm font-semibold">{isRegister ? "Email address" : isAdmin ? "Administrator email" : "Email or phone number"}<Input autoComplete={isRegister || isAdmin ? "email" : "username"} name={isRegister || isAdmin ? "email" : "identifier"} type={isRegister || isAdmin ? "email" : "text"} placeholder={isAdmin ? "name@tupi.gov.ph" : "you@example.com"} required maxLength={191} /></label>
        {isRegister && <>
          <label className="block space-y-1.5 text-sm font-semibold">Phone number<Input autoComplete="tel" name="phone" type="tel" placeholder="+63 917 123 4567" required minLength={7} maxLength={32} /></label>
          <label className="block space-y-1.5 text-sm font-semibold">Barangay<select name="barangay" required defaultValue="" className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[#0d9b91] focus:ring-4 focus:ring-[#0d9b91]/10"><option value="" disabled>Select your barangay</option>{BARANGAYS.map((barangay) => <option key={barangay}>{barangay}</option>)}</select></label>
          <label className="block space-y-1.5 text-sm font-semibold">Complete address<Input autoComplete="street-address" name="address" placeholder="House number, street, barangay" required minLength={5} maxLength={300} /></label>
        </>}
        <label className="block space-y-1.5 text-sm font-semibold">Password<div className="relative"><Input autoComplete={isRegister ? "new-password" : "current-password"} name="password" type={showPassword ? "text" : "password"} placeholder={isRegister ? "At least 8 characters" : "Enter your password"} required minLength={isRegister ? 8 : 1} maxLength={100} className="pr-12" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        {isRegister && <label className="block space-y-1.5 text-sm font-semibold">Confirm password<Input autoComplete="new-password" name="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Enter your password again" required minLength={8} maxLength={100} /></label>}
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">{isRegister ? "Create resident account" : isAdmin ? "Sign in to dashboard" : "Sign in"}</Button>
        {isAdmin && <p className="flex items-center justify-center gap-2 text-center text-xs text-[var(--muted)]"><ShieldCheck size={15} className="text-[#0d9b91]" /> Administrator access is invite-only.</p>}
      </form>
      <p className="mt-5 text-center text-sm text-[var(--muted)]">{isRegister ? <>Already have an account? <Link href="/login" className="font-bold text-[#0d9b91] hover:underline">Sign in</Link></> : isAdmin ? <Link href="/" className="font-semibold hover:text-[#0d9b91]">← Back to ServeLink</Link> : <>New to ServeLink? <Link href="/register" className="font-bold text-[#0d9b91] hover:underline">Create an account</Link></>}</p>
    </div>
  );
}
