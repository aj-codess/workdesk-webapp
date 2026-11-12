"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import clsx from "clsx";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; text: string }
const Ctx = createContext<{ push: (kind: Kind, text: string) => void } | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, text: string) => {
    const id = seq++;
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => remove(id), kind === "error" ? 7000 : 4000);
  }, [remove]);
  const value = useMemo(() => ({ push }), [push]);
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className={clsx("pointer-events-auto pop-in flex items-start gap-2.5 rounded-lg border bg-panel px-3 py-2.5 shadow-pop",
              t.kind === "success" && "border-ok-line", t.kind === "error" && "border-bad-line", t.kind === "info" && "border-info-line")}>
              <I className={clsx("mt-0.5 h-4 w-4 shrink-0", t.kind === "success" && "text-ok-fg", t.kind === "error" && "text-bad-fg", t.kind === "info" && "text-info-fg")} />
              <p className="flex-1 text-sm text-ink">{t.text}</p>
              <button onClick={() => remove(t.id)} className="text-ink-4 hover:text-ink" aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return { success: (t: string) => c.push("success", t), error: (t: string) => c.push("error", t), info: (t: string) => c.push("info", t) };
}
