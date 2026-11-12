"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { download, get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { P } from "@/lib/permissions";
import type { LookupDept, ReportGroup, ReportSummary, TeamRow } from "@/lib/types";
import { PRIORITY_LABEL, STATUS_LABEL, fmtDate, fmtHours, fullName, pct } from "@/lib/format";
import type { Priority, TicketStatus } from "@/lib/types";
import { Button, Card, EmptyState, ErrorState, errorText, Field, Input, PageHeader, Select, Skeleton, TableSkeleton } from "@/components/ui";
import { BarList, Stat } from "@/components/stats";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";

const GROUPS = [["status", "Status"], ["priority", "Priority"], ["department", "Department"], ["category", "Category"], ["agent", "Agent"], ["day", "Day"], ["week", "Week"], ["month", "Month"]] as const;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function Reports() {
  const { can } = useAuth(); const toast = useToast();
  const [from, setFrom] = useState(daysAgo(30)); const [to, setTo] = useState(today());
  const [dept, setDept] = useState(""); const [groupBy, setGroupBy] = useState<(typeof GROUPS)[number][0]>("status");
  const [exporting, setExporting] = useState<string | null>(null);
  const depts = useQuery({ queryKey: ["lookup", "departments"], staleTime: 120_000, queryFn: async () => (await get<LookupDept[]>("/api/lookups/departments")).data });
  const params = { from: from ? new Date(from + "T00:00:00").toISOString() : undefined, to: to ? new Date(to + "T23:59:59").toISOString() : undefined, departmentId: dept };
  const bad = !!from && !!to && from > to;

  const summary = useQuery({ queryKey: ["report", "summary", params], enabled: !bad, queryFn: async () => (await get<ReportSummary>("/api/reports/summary", params)).data });
  const grouped = useQuery({ queryKey: ["report", "tickets", groupBy, params], enabled: !bad, queryFn: async () => (await get<ReportGroup>("/api/reports/tickets", { groupBy, ...params })).data });
  const team = useQuery({ queryKey: ["report", "team", params], enabled: !bad, queryFn: async () => (await get<{ rows: TeamRow[] }>("/api/reports/team-performance", params)).data });

  const doExport = async (type: "tickets" | "team-performance") => {
    setExporting(type);
    try { await download("/api/reports/export", { type, format: "csv", ...params }, `workdesk-${type}.csv`); toast.success("Export downloaded"); }
    catch (e) { toast.error(errorText(e)); } finally { setExporting(null); }
  };
  const label = (k: string) => (groupBy === "status" ? STATUS_LABEL[k as TicketStatus] : groupBy === "priority" ? PRIORITY_LABEL[k as Priority] : undefined);
  const s = summary.data;

  return (
    <>
      <PageHeader title="Reports" subtitle="Figures cover the requests you are allowed to see." actions={can(P.reportsExport) && (
        <>
          <Button loading={exporting === "tickets"} disabled={bad} onClick={() => doExport("tickets")}><Download className="h-3.5 w-3.5" />Export requests</Button>
          <Button loading={exporting === "team-performance"} disabled={bad} onClick={() => doExport("team-performance")}><Download className="h-3.5 w-3.5" />Export team</Button>
        </>)} />
      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="From" htmlFor="from"><Input id="from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="!w-40" /></Field>
          <Field label="To" htmlFor="to"><Input id="to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="!w-40" /></Field>
          <Field label="Department" htmlFor="rd"><Select id="rd" value={dept} onChange={(e) => setDept(e.target.value)} className="!w-52"><option value="">All departments</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <div className="flex gap-1.5 pb-0.5">
            {[["7 days", 7], ["30 days", 30], ["90 days", 90]].map(([l, n]) => <Button key={l} size="sm" variant="ghost" onClick={() => { setFrom(daysAgo(n as number)); setTo(today()); }}>{l}</Button>)}
          </div>
          {bad && <p className="field-error pb-2">The start date is after the end date.</p>}
        </div>
      </Card>

      <div className="space-y-5">
        <section>
          {summary.isLoading ? <div className="grid grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
            : summary.isError ? <Card><ErrorState error={summary.error} onRetry={() => summary.refetch()} /></Card> : s && (
            <>
              <div className="grid grid-cols-6 gap-4">
                <Stat label="Created" value={s.totals.created} /><Stat label="Resolved" value={s.totals.resolved} tone="ok" /><Stat label="Closed" value={s.totals.closed} />
                <Stat label="Rejected" value={s.totals.rejected} /><Stat label="Open now" value={s.totals.open} tone={s.totals.open ? "warn" : undefined} />
                <Stat label="Avg resolution" value={fmtHours(s.avgResolutionHours)} hint={`Reopen rate ${pct(s.reopenRate)}`} />
              </div>
              <p className="mt-2 text-xs text-ink-3">Period {fmtDate(s.period.from)} to {fmtDate(s.period.to)}</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Card title="By status"><BarList rows={Object.entries(s.byStatus).map(([k, v]) => ({ label: STATUS_LABEL[k as TicketStatus] ?? k, value: v }))} /></Card>
                <Card title="By priority"><BarList color="bg-teal-fg" rows={Object.entries(s.byPriority).map(([k, v]) => ({ label: PRIORITY_LABEL[k as Priority] ?? k, value: v }))} /></Card>
              </div>
            </>
          )}
        </section>

        <Card title="Requests grouped by" actions={<Select className="!w-40" value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} aria-label="Group by">{GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}>
          {grouped.isLoading ? <Skeleton className="h-32 w-full" /> : grouped.isError ? <ErrorState error={grouped.error} onRetry={() => grouped.refetch()} /> : (
            <BarList rows={grouped.data!.rows.map((r) => ({ label: label(r.key) ?? r.label, value: r.count }))} />
          )}
        </Card>

        <Card title="Team performance" flush>
          {team.isLoading ? <TableSkeleton cols={6} rows={4} /> : team.isError ? <ErrorState error={team.error} onRetry={() => team.refetch()} /> : !team.data!.rows.length ? <EmptyState title="No agent activity in this period" /> : (
            <table className="tbl"><thead><tr><th>Agent</th><th className="num">Assigned</th><th className="num">Resolved</th><th className="num">Open</th><th className="num">Reopened</th><th className="num">Avg resolution</th></tr></thead>
              <tbody>{team.data!.rows.map((r) => <tr key={r.agent.id}><td className="font-medium text-ink">{fullName(r.agent)}</td><td className="num">{r.assigned}</td><td className="num">{r.resolved}</td><td className="num">{r.open}</td><td className="num">{r.reopened}</td><td className="num">{fmtHours(r.avgResolutionHours)}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
    </>
  );
}
export default function ReportsPage() { return <RequirePermission any={P.reportsView}><Reports /></RequirePermission>; }
