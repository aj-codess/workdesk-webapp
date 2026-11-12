"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Filter state kept in the URL so a filtered list can be bookmarked, shared and survives the back button. */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const state = Object.fromEntries(Object.keys(defaults).map((k) => [k, sp.get(k) ?? defaults[k]])) as T;
  const set = useCallback((patch: Partial<T>, resetPage = true) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || v === defaults[k]) next.delete(k); else next.set(k, String(v));
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, path, router]);
  return [state, set] as const;
}
