"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";
import { Button } from "./index";

export function Modal({ open, onClose, title, description, children, footer, width = "md", dismissable = true }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl"; dismissable?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) { e.stopPropagation(); onClose(); }
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus],input:not([type=hidden]),textarea,select")?.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; clearTimeout(t); (prev.current as HTMLElement | null)?.focus?.(); };
  }, [open, onClose, dismissable]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-12" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissable) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={id}
        className={clsx("pop-in w-full rounded-lg border border-line bg-panel shadow-pop", { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[width])}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            <h2 id={id} className="text-lg">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
          </div>
          {dismissable && <button onClick={onClose} className="rounded p-1 text-ink-3 hover:bg-canvas hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>}
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 rounded-b-lg border-t border-line bg-[#F8F9FB] px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = "Confirm", danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; children?: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="sm"
      footer={<><Button onClick={onClose} disabled={loading}>Cancel</Button><Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm} data-autofocus>{confirmLabel}</Button></>}>
      <div className="text-sm text-ink-2">{children}</div>
    </Modal>
  );
}
