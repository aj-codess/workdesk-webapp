"use client";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Activity, Assignment } from "@/lib/types";
import { ACTIVITY_LABEL, STATUS_LABEL, fmtDateTime, fullName, humanize } from "@/lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import type { TicketStatus } from "@/lib/types";

function metaLines(m: Activity["metadata"]): string[] {
  if (!m) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out.push(`${humanize(k)}: ${String(v)}`);
  }
  return out;
}

export function ActivityList({ ticketId }: { ticketId: string }) {
  const q = useQuery({ queryKey: ["ticket", ticketId, "activity"], queryFn: async () => (await get<Activity[]>(`/api/tickets/${ticketId}/activity`, { limit: 100 })).data });
  if (q.isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data!.length) return <EmptyState title="No activity yet" />;
  return (
    <ol className="px-5 py-4">
      {q.data!.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < q.data!.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden />}
          <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-brand-500 bg-panel" aria-hidden />
          <div className="min-w-0 text-sm">
            <p><span className="font-medium">{a.actor ? fullName(a.actor) : "System"}</span> <span className="text-ink-2">{(ACTIVITY_LABEL[a.action] ?? humanize(a.action)).replace(/^(\w)/, (c) => c.toLowerCase())}</span></p>
            {a.fromStatus && a.toStatus && a.fromStatus !== a.toStatus && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3"><StatusBadge status={a.fromStatus as TicketStatus} /> to <StatusBadge status={a.toStatus as TicketStatus} /></p>
            )}
            {metaLines(a.metadata).map((l) => <p key={l} className="mt-0.5 text-xs text-ink-3">{STATUS_LABEL[l as TicketStatus] ?? l}</p>)}
            <p className="mt-0.5 text-xs text-ink-4">{fmtDateTime(a.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AssignmentList({ ticketId }: { ticketId: string }) {
  const q = useQuery({ queryKey: ["ticket", ticketId, "assignments"], queryFn: async () => (await get<Assignment[]>(`/api/tickets/${ticketId}/assignments`)).data });
  if (q.isLoading) return <TableSkeleton rows={3} cols={4} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data!.length) return <EmptyState title="Never assigned" text="Assignments appear here once a manager assigns an agent." />;
  return (
    <table className="tbl">
      <thead><tr><th>Agent</th><th>Assigned by</th><th>Assigned</th><th>Until</th><th>Reason</th></tr></thead>
      <tbody>
        {q.data!.map((a) => (
          <tr key={a.id}>
            <td className="font-medium text-ink">{fullName(a.agent)}</td><td>{fullName(a.assignedBy)}</td>
            <td className="whitespace-nowrap">{fmtDateTime(a.assignedAt)}</td>
            <td className="whitespace-nowrap">{a.unassignedAt ? fmtDateTime(a.unassignedAt) : <span className="text-ok-fg">Current</span>}</td>
            <td className="text-ink-3">{a.reason ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
