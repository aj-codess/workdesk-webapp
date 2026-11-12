"use client";
import { useRouter } from "next/navigation";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { fmtAgo, fullName } from "@/lib/format";
import type { TicketSummary } from "@/lib/types";

export function TicketTable({ rows, showRequester = true, compact }: { rows: TicketSummary[]; showRequester?: boolean; compact?: boolean }) {
  const router = useRouter();
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Reference</th><th>Request</th><th>Status</th><th>Priority</th>
            {!compact && <th>Department</th>}
            {showRequester && !compact && <th>Requester</th>}
            {!compact && <th>Assigned to</th>}
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="row-link" onClick={() => router.push(`/tickets/${t.id}`)}>
              <td className="whitespace-nowrap font-mono text-xs text-ink-3">{t.reference}</td>
              <td className="max-w-[340px]">
                <a href={`/tickets/${t.id}`} onClick={(e) => { e.preventDefault(); }} className="block truncate font-medium text-ink no-underline">{t.title}</a>
                <span className="block truncate text-xs text-ink-3">{t.category.name}</span>
              </td>
              <td><StatusBadge status={t.status} /></td>
              <td><PriorityBadge priority={t.priority} /></td>
              {!compact && <td className="whitespace-nowrap">{t.department.name}</td>}
              {showRequester && !compact && <td className="whitespace-nowrap">{fullName(t.requester)}</td>}
              {!compact && <td className="whitespace-nowrap">{t.assignedAgent ? fullName(t.assignedAgent) : <span className="text-ink-4">Unassigned</span>}</td>}
              <td className="whitespace-nowrap text-ink-3">{fmtAgo(t.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
