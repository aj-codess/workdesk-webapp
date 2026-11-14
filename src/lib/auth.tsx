"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, get, post, refreshAccessToken, tokenStore } from "./api";
import type { AuthUser, LoginResult, Me } from "./types";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthCtx {
  status: Status;
  user: AuthUser | null;
  permissions: ReadonlySet<string>;
  /** Reusable permission check. `can("a")`, or `can("a","b")` = holds at least one. */
  can: (...keys: string[]) => boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  /** Re-read identity and permissions (after a role change, a 403, or on window focus). */
  reload: () => Promise<void>;
  setUser: (u: AuthUser) => void;
  /** Reason the last session ended, shown once on the login screen. */
  endedReason: string | null;
  clearEndedReason: () => void;
}

function subjectOf(token: string): string | null {
  try { return (JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string }).sub ?? null; } catch { return null; }
}

const Ctx = createContext<AuthCtx | null>(null);
const EMPTY: ReadonlySet<string> = new Set();

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const lastReload = useRef(0);

  const apply = useCallback((m: Me) => { setMe(m); setStatus("authenticated"); }, []);
  const drop = useCallback((reason?: string) => {
    tokenStore.set(null); setMe(null); setStatus("anonymous"); qc.clear();
    if (reason) setEndedReason(reason);
  }, [qc]);

  // Page load: the refresh cookie is the only thing that survives a reload.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshAccessToken();
        const r = await get<Me>("/api/auth/me");
        if (alive) apply(r.data);
      } catch {
        if (alive) { tokenStore.set(null); setStatus("anonymous"); }
      }
    })();
    return () => { alive = false; };
  }, [apply]);

  useEffect(() => tokenStore.onSessionLost(() => drop("Your session ended. Please sign in again.")), [drop]);

  const reload = useCallback(async () => {
    lastReload.current = Date.now();
    try { apply((await get<Me>("/api/auth/me")).data); } catch (e) { if (!(e instanceof ApiError) || e.status !== 401) return; }
  }, [apply]);

  // Permissions can change on the server at any time: refresh them when the tab regains focus.
  useEffect(() => {
    if (status !== "authenticated") return;
    const onFocus = () => { if (Date.now() - lastReload.current > 30_000) void reload(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, reload]);

  useEffect(() => {
    const h = () => { void reload(); };
    window.addEventListener("workdesk:permissions-stale", h);
    return () => window.removeEventListener("workdesk:permissions-stale", h);
  }, [reload]);

  // The refresh cookie is shared by every tab of a browser. If another tab signs in as someone else, this tab's next
  // token renewal belongs to that user. Detect it and switch identity instead of showing one user and acting as another.
  const userId = me?.user.id;
  useEffect(() => {
    if (!userId) return;
    return tokenStore.onChange((token) => {
      const sub = token ? subjectOf(token) : null;
      if (sub && sub !== userId) { void reload(); }
    });
  }, [userId, reload]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await post<LoginResult>("/api/auth/login", { email, password });
    tokenStore.set(r.data.accessToken, r.data.expiresIn);
    qc.clear();
    setEndedReason(null);
    apply({ user: r.data.user, permissions: r.data.permissions });
    return r.data;
  }, [apply, qc]);

  const logout = useCallback(async () => {
    try { await post("/api/auth/logout"); } catch { /* idempotent; the local session ends regardless */ }
    drop();
  }, [drop]);

  const permissions = useMemo(() => (me ? new Set(me.permissions) : EMPTY), [me]);
  const can = useCallback((...keys: string[]) => keys.length === 0 || keys.some((k) => permissions.has(k)), [permissions]);

  const value = useMemo<AuthCtx>(() => ({
    status, user: me?.user ?? null, permissions, can, login, logout, reload,
    setUser: (u) => setMe((m) => (m ? { ...m, user: u } : m)),
    endedReason, clearEndedReason: () => setEndedReason(null),
  }), [status, me, permissions, can, login, logout, reload, endedReason]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
