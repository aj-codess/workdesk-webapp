"use client";
import clsx from "clsx";
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Inbox, Loader2, Lock, Search, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { initials } from "@/lib/format";
import type { Meta } from "@/lib/types";

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: boolean }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading}
      className={clsx("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", icon && "btn-icon", className)} {...rest}>
      {loading && <Loader2 className="h-3.5 w-3.5 spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({ href, variant = "secondary", size = "md", className, children }: { href: string; variant?: Variant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  return <Link href={href} className={clsx("btn no-underline", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", variant === "primary" && "!text-white", className)}>{children}</Link>;
}

/* ---------- Fields ---------- */
export function Field({ label, error, hint, required, children, className, htmlFor }: { label?: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      {label && <label className="label" htmlFor={htmlFor}>{label}{required && <span className="ml-0.5 text-bad-fg" aria-hidden>*</span>}</label>}
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ invalid, className, ...r }, ref) {
  return <input ref={ref} className={clsx("input", invalid && "input-error", className)} aria-invalid={invalid || undefined} {...r} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ invalid, className, ...r }, ref) {
  return <textarea ref={ref} className={clsx("input", invalid && "input-error", className)} aria-invalid={invalid || undefined} {...r} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ invalid, className, children, ...r }, ref) {
  return <select ref={ref} className={clsx("input", invalid && "input-error", className)} aria-invalid={invalid || undefined} {...r}>{children}</select>;
});

export function SearchBox({ value, onChange, placeholder = "Search", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={clsx("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-ink-4" aria-hidden />
      <input className="input pl-8 pr-7" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button className="absolute right-1.5 top-1.5 rounded p-0.5 text-ink-4 hover:text-ink" onClick={() => onChange("")} aria-label="Clear search"><X className="h-4 w-4" /></button>}
    </div>
  );
}

export function Checkbox({ label, hint, className, ...r }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx("flex cursor-pointer items-start gap-2.5 text-sm", r.disabled && "cursor-not-allowed opacity-60", className)}>
      <input id={id} type="checkbox" className="check mt-0.5" {...r} />
      <span><span className="text-ink">{label}</span>{hint && <span className="block text-xs text-ink-3">{hint}</span>}</span>
    </label>
  );
}

/* ---------- Badges ---------- */
export type Tone = "ok" | "warn" | "bad" | "info" | "mute" | "teal";
export function Badge({ tone = "mute", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t: Record<Tone, string> = {
    ok: "bg-ok-bg text-ok-fg border-ok-line", warn: "bg-warn-bg text-warn-fg border-warn-line", bad: "bg-bad-bg text-bad-fg border-bad-line",
    info: "bg-info-bg text-info-fg border-info-line", mute: "bg-mute-bg text-mute-fg border-mute-line", teal: "bg-teal-bg text-teal-fg border-teal-line",
  };
  return <span className={clsx("badge", t[tone], className)}>{children}</span>;
}

export function Avatar({ user, size = 28 }: { user?: { firstName: string; lastName: string } | null; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>{initials(user)}</span>
  );
}

/* ---------- Layout bits ---------- */
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5">
      {back && <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs text-ink-3 no-underline hover:text-brand-600"><ChevronLeft className="h-3.5 w-3.5" />{back.label}</Link>}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClassName, flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; flush?: boolean }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && <header className="card-head"><h2 className="card-title">{title}</h2>{actions && <div className="flex items-center gap-2">{actions}</div>}</header>}
      <div className={clsx(!flush && "card-body", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number; hidden?: boolean }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-line" role="tablist">
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            value === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-ink-3 hover:text-ink")}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded bg-mute-bg px-1.5 text-xs text-mute-fg">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- States ---------- */
export function Spinner({ className }: { className?: string }) { return <Loader2 className={clsx("h-4 w-4 spin text-ink-3", className)} aria-label="Loading" />; }

export function Skeleton({ className }: { className?: string }) { return <div className={clsx("skeleton h-4", className)} />; }

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-3 py-3.5">{Array.from({ length: cols }).map((__, j) => <Skeleton key={j} className={clsx("h-3.5", j === 0 ? "w-24" : j === 1 ? "w-56" : "w-20")} />)}</div>
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-mute-bg text-ink-3">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-3">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return `Too many attempts. ${e.retryAfterSeconds ? `Try again in ${e.retryAfterSeconds} seconds.` : "Please wait a moment and try again."}`;
    if (e.status === 0) return e.message;
    if (e.status >= 500) return "Something went wrong on the server. Please try again.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className={clsx("mb-3 flex h-10 w-10 items-center justify-center rounded-full", forbidden ? "bg-warn-bg text-warn-fg" : "bg-bad-bg text-bad-fg")}>
        {forbidden ? <Lock className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      </div>
      <p className="text-sm font-semibold">{forbidden ? "You do not have access to this" : "Could not load this"}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{errorText(error)}</p>
      {onRetry && !forbidden && <Button className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "bad" | "ok"; title?: string; children?: ReactNode; className?: string }) {
  const t = { info: "border-info-line bg-info-bg text-info-fg", warn: "border-warn-line bg-warn-bg text-warn-fg", bad: "border-bad-line bg-bad-bg text-bad-fg", ok: "border-ok-line bg-ok-bg text-ok-fg" }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={clsx("flex gap-2.5 rounded-md border px-3 py-2.5 text-sm", t, className)}>
      {tone === "bad" || tone === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>{title && <p className="font-semibold">{title}</p>}{children && <div className={clsx(title && "mt-0.5")}>{children}</div>}</div>
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ meta, onPage, onLimit }: { meta?: Meta; onPage: (p: number) => void; onLimit?: (n: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-3 py-2.5 text-xs text-ink-3">
      <span>{from}-{to} of {meta.total}</span>
      <div className="flex items-center gap-3">
        {onLimit && (
          <label className="flex items-center gap-1.5">Rows
            <select className="input !h-7 !w-16 !py-0 text-xs" value={meta.limit} onChange={(e) => onLimit(Number(e.target.value))}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button size="sm" icon variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[72px] text-center tabular-nums">Page {meta.page} of {Math.max(1, meta.totalPages)}</span>
          <Button size="sm" icon variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Popover multi-select (filters) ---------- */
export function MultiSelect({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={clsx("btn btn-secondary", value.length > 0 && "!border-brand-500 !bg-brand-50 !text-brand-700")} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {label}{value.length > 0 && <span className="rounded bg-brand-600 px-1.5 text-xs text-white">{value.length}</span>}
        <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
      </button>
      {open && (
        <div className="pop-in absolute left-0 top-9 z-30 w-60 rounded-lg border border-line bg-panel p-1.5 shadow-pop">
          <div className="max-h-72 overflow-auto scroll-thin">
            {options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-canvas">
                <input type="checkbox" className="check" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />{o.label}
              </label>
            ))}
          </div>
          {value.length > 0 && <button className="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-brand-600 hover:bg-canvas" onClick={() => onChange([])}>Clear selection</button>}
        </div>
      )}
    </div>
  );
}

export function Menu({ trigger, children, align = "right" }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && <div className={clsx("pop-in absolute top-full z-40 mt-1 min-w-[200px] rounded-lg border border-line bg-panel py-1 shadow-pop", align === "right" ? "right-0" : "left-0")}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
