"use client";
import { Monitor } from "lucide-react";
import type { SessionRow } from "@/lib/types";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { Badge, Button, EmptyState } from "@/components/ui";

export function deviceName(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function SessionList({ rows, onRevoke, busyId }: { rows: SessionRow[]; onRevoke?: (s: SessionRow) => void; busyId?: string | null }) {
  if (!rows.length) return <EmptyState title="No active sessions" />;
  return (
    <ul className="divide-y divide-line">
      {rows.map((s) => (
        <li key={s.id} className="flex items-center gap-3 px-4 py-3">
          <Monitor className="h-4 w-4 shrink-0 text-ink-3" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{deviceName(s.userAgent)} {s.current && <Badge tone="ok" className="ml-1">This device</Badge>}</p>
            <p className="text-xs text-ink-3">{s.ipAddress ?? "Unknown address"} · Active {fmtAgo(s.lastUsedAt)} · Started {fmtDateTime(s.createdAt)}</p>
          </div>
          {onRevoke && !s.current && <Button size="sm" loading={busyId === s.id} onClick={() => onRevoke(s)}>End session</Button>}
        </li>
      ))}
    </ul>
  );
}
