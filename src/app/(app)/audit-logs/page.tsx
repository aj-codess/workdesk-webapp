"use client";
import { Fragment, Suspense, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";
import { get } from "@/lib/api";
import { useUrlState } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import type { AuditLog, Paged } from "@/lib/types";
import { fmtDateTime, fullName } from "@/lib/format";
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, TableSkeleton } from "@/components/ui";
import { RequirePermission } from "@/components/permission";

const AREAS = [["", "All activity"], ["auth.", "Sign-in and sessions"], ["users.", "Users"], ["roles.", "Roles and permissions"], ["departments.", "Departments"], ["tickets.", "Requests"], ["reports.", "Reports"], ["settings.", "Settings"], ["access.", "Denied access"]] as const;
const tone = { SUCCESS: "ok", DENIED: "warn", FAILURE: "bad" } as const;

function Json({ label, v }: { label: string; v: unknown }) {
  if (v === null || v === undefined) return null;
  return <div><p className="mb-1 text-xs font-semibold text-ink-3">{label}</p><pre className="max-h-56 overflow-auto rounded border border-line bg-canvas p-2.5 text-xs leading-5 scroll-thin">{JSON.stringify(v, null, 2)}</pre></div>;
}

function List() {
  const [f, setF] = useUrlState({ area: "", action: "", outcome: "", from: "", to: "", entityType: "", page: "1", limit: "25" });
  const [open, setOpen] = useState<string | null>(null);
  const action = f.action || f.area;
  const q = useQuery({
    queryKey: ["audit", f], placeholderData: keepPreviousData,
    queryFn: async () => {
      const r = await get<AuditLog[]>("/api/audit-logs", { action, outcome: f.outcome, entityType: f.entityType, from: f.from ? new Date(f.from + "T00:00:00").toISOString() : undefined, to: f.to ? new Date(f.to + "T23:59:59").toISOString() : undefined, page: f.page, limit: f.limit });
      return { data: r.data, meta: r.meta! } as Paged<AuditLog>;
    },
  });
  const filtered = !!(f.area || f.action || f.outcome || f.from || f.to || f.entityType);
  return (
    <>
      <PageHeader title="Audit log" subtitle="A permanent record of sensitive activity. Entries cannot be edited or deleted." />
      <Card flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <Select className="!w-48" value={f.area} onChange={(e) => setF({ area: e.target.value, action: "" })} aria-label="Area">{AREAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          <Input className="!w-52" placeholder="Exact action, e.g. users.created" value={f.action} onChange={(e) => setF({ action: e.target.value })} aria-label="Action" />
          <Select className="!w-36" value={f.outcome} onChange={(e) => setF({ outcome: e.target.value })} aria-label="Outcome"><option value="">Any outcome</option><option value="SUCCESS">Success</option><option value="DENIED">Denied</option><option value="FAILURE">Failure</option></Select>
          <Input className="!w-36" type="date" value={f.from} onChange={(e) => setF({ from: e.target.value })} aria-label="From date" />
          <span className="text-xs text-ink-3">to</span>
          <Input className="!w-36" type="date" value={f.to} onChange={(e) => setF({ to: e.target.value })} aria-label="To date" />
          {filtered && <Button size="sm" variant="ghost" onClick={() => setF({ area: "", action: "", outcome: "", from: "", to: "", entityType: "" })}>Clear filters</Button>}
        </div>
        {q.isLoading ? <TableSkeleton cols={5} rows={8} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.data.length ? <EmptyState title="No entries match" text="Try widening the date range or clearing filters." /> : (
          <>
            <table className="tbl">
              <thead><tr><th className="w-6" /><th>Time</th><th>Who</th><th>Action</th><th>Target</th><th>Outcome</th><th>IP address</th></tr></thead>
              <tbody>{q.data!.data.map((l) => (
                <Fragment key={l.id}>
                  <tr className="row-link" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                    <td><ChevronRight className={clsx("h-4 w-4 text-ink-3 transition-transform", open === l.id && "rotate-90")} /></td>
                    <td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                    <td>{l.actor ? fullName(l.actor) : <span className="text-ink-4">Anonymous</span>}</td>
                    <td className="font-mono text-xs text-ink">{l.action}</td>
                    <td className="text-ink-3">{l.entityType ? `${l.entityType}${l.entityId ? ` ${String(l.entityId).slice(0, 8)}` : ""}` : "-"}</td>
                    <td><Badge tone={tone[l.outcome]}>{l.outcome.charAt(0) + l.outcome.slice(1).toLowerCase()}</Badge></td>
                    <td className="font-mono text-xs text-ink-3">{l.ipAddress ?? "-"}</td>
                  </tr>
                  {open === l.id && (
                    <tr><td /><td colSpan={6} className="!bg-[#FAFBFC] !py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Json label="Before" v={l.before} /><Json label="After" v={l.after} />
                      </div>
                      <dl className="kv mt-3 grid grid-cols-3 gap-4">
                        <div><dt>Entity id</dt><dd className="!mb-0 break-all font-mono text-xs">{l.entityId ?? "-"}</dd></div>
                        <div><dt>Request id</dt><dd className="!mb-0 break-all font-mono text-xs">{l.requestId ?? "-"}</dd></div>
                        <div><dt>Device</dt><dd className="!mb-0 break-all text-xs">{l.userAgent ?? "-"}</dd></div>
                      </dl>
                    </td></tr>
                  )}
                </Fragment>))}</tbody>
            </table>
            <Pagination meta={q.data!.meta} onPage={(p) => setF({ page: String(p) }, false)} onLimit={(n) => setF({ limit: String(n) })} />
          </>
        )}
      </Card>
    </>
  );
}
export default function AuditPage() { return <RequirePermission any={P.auditView}><Suspense><List /></Suspense></RequirePermission>; }
