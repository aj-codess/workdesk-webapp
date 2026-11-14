// Single HTTP client. Access token lives in memory only; the refresh token is an HttpOnly cookie the browser handles.
import type { Meta, RefreshResult } from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

export interface FieldIssue { path: string; message: string }

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  retryAfterSeconds?: number;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    if (status === 429 && details && typeof details === "object" && "retryAfterSeconds" in details) {
      this.retryAfterSeconds = Number((details as { retryAfterSeconds: unknown }).retryAfterSeconds) || undefined;
    }
  }
  /** zod issues from a 400 as { field: message } */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.code === "VALIDATION_ERROR" && Array.isArray(this.details)) {
      for (const i of this.details as { path?: unknown; message?: unknown }[]) {
        const p = Array.isArray(i.path) ? i.path.join(".") : String(i.path ?? "");
        if (p && !out[p]) out[p] = String(i.message ?? "Invalid value");
      }
    }
    return out;
  }
}

let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
type Listener = () => void;
const onSessionLost: Listener[] = [];
const onTokenChange: ((token: string | null) => void)[] = [];

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null, expiresInSeconds?: number) {
    accessToken = token;
    onTokenChange.slice().forEach((fn) => fn(token));
    if (refreshTimer) clearTimeout(refreshTimer);
    if (token && expiresInSeconds && typeof window !== "undefined") {
      // Renew a minute early so users are never interrupted by an expired token.
      refreshTimer = setTimeout(() => { void refreshAccessToken().catch(() => {}); }, Math.max(15, expiresInSeconds - 60) * 1000);
    }
  },
  onChange(fn: (token: string | null) => void) {
    onTokenChange.push(fn);
    return () => { const i = onTokenChange.indexOf(fn); if (i >= 0) onTokenChange.splice(i, 1); };
  },
  onSessionLost(fn: Listener) {
    onSessionLost.push(fn);
    return () => { const i = onSessionLost.indexOf(fn); if (i >= 0) onSessionLost.splice(i, 1); };
  },
};

function sessionLost() {
  tokenStore.set(null);
  onSessionLost.slice().forEach((fn) => fn());
}

let refreshing: Promise<string> | null = null;

/** One refresh at a time: concurrent callers (and React strict-mode double effects) share the same request, because refresh tokens rotate and are single use. */
export function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await rawFetch("/api/auth/refresh", { method: "POST", auth: false });
      const body = await parse<RefreshResult>(res);
      tokenStore.set(body.data.accessToken, body.data.expiresIn);
      return body.data.accessToken;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

interface RawOptions { method?: string; body?: unknown; query?: Record<string, unknown>; auth?: boolean; signal?: AbortSignal; form?: FormData; headers?: Record<string, string> }

function buildUrl(path: string, query?: Record<string, unknown>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ""}`;
}

async function rawFetch(path: string, o: RawOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", ...o.headers };
  let body: BodyInit | undefined;
  if (o.form) body = o.form;
  else if (o.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(o.body); }
  if (o.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(buildUrl(path, o.query), {
      method: o.method ?? "GET", headers, body, signal: o.signal,
      credentials: BASE ? "include" : "same-origin", cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection and try again.");
  }
}

interface Envelope<T> { success: boolean; message: string; data: T; meta?: Meta; code?: string; details?: unknown }

async function parse<T>(res: Response): Promise<Envelope<T>> {
  if (res.status === 204) return { success: true, message: "", data: undefined as T };
  let json: Envelope<T> | undefined;
  try { json = (await res.json()) as Envelope<T>; } catch { /* non-JSON body */ }
  if (!res.ok) {
    throw new ApiError(res.status, json?.code ?? (res.status === 429 ? "TOO_MANY_REQUESTS" : "HTTP_ERROR"),
      json?.message ?? `Request failed (${res.status})`, json?.details);
  }
  return json ?? { success: true, message: "", data: undefined as T };
}

export async function api<T = unknown>(path: string, o: RawOptions = {}): Promise<Envelope<T>> {
  let res = await rawFetch(path, o);
  if (res.status === 401 && o.auth !== false) {
    // Expired access token: refresh once and retry. Anything else that is a 401 ends the session.
    const peek = await res.clone().json().catch(() => null) as { code?: string } | null;
    if (peek?.code === "TOKEN_EXPIRED" || (peek?.code === "UNAUTHENTICATED" && !accessToken)) {
      try { await refreshAccessToken(); } catch { sessionLost(); throw new ApiError(401, "SESSION_REVOKED", "Your session has ended. Please sign in again."); }
      res = await rawFetch(path, o);
    }
  }
  try {
    return await parse<T>(res);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && (e.code === "SESSION_REVOKED" || e.code === "UNAUTHENTICATED" || e.code === "TOKEN_EXPIRED") && o.auth !== false) sessionLost();
    throw e;
  }
}

export const get = <T>(path: string, query?: Record<string, unknown>, signal?: AbortSignal) => api<T>(path, { query, signal });
export const post = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const put = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body });
export const patch = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body });
export const del = <T = void>(path: string) => api<T>(path, { method: "DELETE" });

/** Authenticated download (bearer header cannot be sent by a plain link). Saves the response as a file. */
export async function download(path: string, query: Record<string, unknown> | undefined, fallbackName: string) {
  const go = () => rawFetch(path, { query, headers: { Accept: "*/*" } });
  let res = await go();
  if (res.status === 401) { await refreshAccessToken().catch(() => { sessionLost(); }); res = await go(); }
  if (!res.ok) await parse(res); // throws ApiError
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const name = m?.[1] ? decodeURIComponent(m[1]) : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const uploadFile = <T>(path: string, form: FormData) => api<T>(path, { method: "POST", form });
