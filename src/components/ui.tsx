"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, className, children, disabled, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-[#12365a] text-white hover:bg-[#0d2945] dark:bg-[#a8d1ff] dark:text-[#10253b] dark:hover:bg-[#d2e6ff]",
    secondary: "border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[#0d9b91]/50 hover:bg-[var(--accent-soft)]",
    ghost: "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition duration-200 hover:shadow-md active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none", variants[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle size={17} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const controlClass = "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)]/70 hover:border-slate-300 focus:border-[#0d9b91] focus:ring-4 focus:ring-[#0d9b91]/10 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "min-h-28 resize-y", className)} {...props} />;
}

export function Card({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_10px_32px_rgba(27,57,87,.055)] transition-shadow duration-200", className)}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
  const label: Record<string, string> = { PENDING: "Pending", IN_PROGRESS: "In progress", RESOLVED: "Resolved" };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", classes[status] ?? "bg-slate-100 text-slate-700")}>{label[status] ?? status}</span>;
}
