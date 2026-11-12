"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { P } from "@/lib/permissions";
import type { DeptDash, MyRequestsDash, MyWorkDash, SystemDash } from "@/lib/types";
import { Card, EmptyState, ErrorState, LinkButton, Skeleton } from "@/components/ui";
import { BarList, Stat } from "@/components/stats";
import { TicketTable } from "@/components/tickets/ticket-table";
import { STATUS_LABEL, PRIORITY_LABEL, fmtHours, fullName } from "@/lib/format";
import { TICKET_VIEW } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import type { Priority, TicketStatus } from "@/lib/types";

function StatsSkeleton({ n = 4 }: { n?: number }) {
  return <div className={`grid gap-4 grid-cols-${n}`}>{Array.from({ length: n }).map((_, i) => <div key={i} className="rounded-lg border border-line bg-panel p-4"><Skeleton className="w-20" /><Skeleton className="mt-3 h-7 w-12" /></div>)}</div>;
}

function MyRequests() {
  const q = useQuery({ queryKey: ["dash", "my-requests"], queryFn: async () => (await get<MyRequestsDash>("/api/dashboard/my-requests")).data });
  if (q.isLoading) return <StatsSkeleton />;
  if (q.isError) return <Card title="My requests"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
  const d = q.data!;
  return (
    <section>
      <h2 className="mb-3 text-base">My requests</h2>
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Total submitted" value={d.total} />
        <Stat label="Open" value={d.open} />
        <Stat label="Waiting on review" value={d.pending} tone={d.pending ? "warn" : undefined} hint="Pending or needs clarification" />
        <Stat label="Resolved" value={d.resolved} tone="ok" />
      </div>
      <Card className="mt-4" title="Recently updated" actions={<Link className="text-xs" href="/tickets?view=mine">View all</Link>} flush>
        {d.recentlyUpdated.length ? <TicketTable rows={d.recentlyUpdated} compact /> : <EmptyState title="No requests yet" text="Requests you submit will appear here." action={<LinkButton href="/tickets/new" variant="primary">New request</LinkButton>} />}
      </Card>
    </section>
  );
}

function MyWork() {
  const q = useQuery({ queryKey: ["dash", "my-work"], queryFn: async () => (await get<MyWorkDash>("/api/dashboard/my-work")).data });
  if (q.isLoading) return <StatsSkeleton />;
  if (q.isError) return <Card title="My work"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
  const d = q.data!;
  return (
    <section>
      <h2 className="mb-3 text-base">Assigned to me</h2>
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Assigned in total" value={d.assigned} />
        <Stat label="Open" value={d.open} tone={d.open ? "warn" : undefined} />
        <Stat label="In progress" value={d.inProgress} />
        <Stat label="Resolved, last 30 days" value={d.resolvedLast30Days} tone="ok" />
      </div>
      <Card className="mt-4" title="Recently updated" actions={<Link className="text-xs" href="/tickets?view=assigned">View all</Link>} flush>
        {d.recentlyUpdated.length ? <TicketTable rows={d.recentlyUpdated} /> : <EmptyState title="Nothing assigned to you" text="Requests assigned to you will show up here." />}
      </Card>
    </section>
  );
}

function Department() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ["dash", "department"], queryFn: async () => (await get<DeptDash>("/api/dashboard/department")).data });
  if (q.isLoading) return <StatsSkeleton />;
  if (q.isError) return <Card title="My departments"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
  const { departments } = q.data!;
  if (!departments.length && can(P.tViewAll)) return null; // administrators already see everything above
  if (!departments.length) return <Card title="My departments"><EmptyState title="You do not manage a department yet" text="An administrator can add you as a department manager." /></Card>;
  return (
    <section className="space-y-5">
      {departments.map((d) => (
        <div key={d.department.id}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base">{d.department.name}</h2>
            <Link className="text-xs" href={`/tickets?view=department&departmentId=${d.department.id}`}>Open queue</Link>
          </div>
          <div className="grid grid-cols-5 gap-4">
            <Stat label="All requests" value={d.totalRequests} />
            <Stat label="Pending review" value={d.pendingReview} tone={d.pendingReview ? "warn" : undefined} />
            <Stat label="Needs clarification" value={d.clarificationRequested} />
            <Stat label="Accepted, unassigned" value={d.unassignedAccepted} tone={d.unassignedAccepted ? "bad" : undefined} />
            <Stat label="Being worked on" value={d.awaitingResolution} hint={d.avgResolutionHours !== null ? `Avg resolution ${fmtHours(d.avgResolutionHours)}` : `Avg resolution needs ${5 - d.resolvedSampleSize > 0 ? 5 - d.resolvedSampleSize : 0} more resolved`} />
          </div>
          <Card className="mt-4" title="Workload by agent" flush>
            {d.byAgent.length ? (
              <table className="tbl">
                <thead><tr><th>Agent</th><th className="num">Open</th><th className="num">Resolved</th></tr></thead>
                <tbody>{d.byAgent.map((a) => <tr key={a.agent.id}><td>{fullName(a.agent)}<span className="ml-2 text-xs text-ink-3">{a.agent.email}</span></td><td className="num">{a.open}</td><td className="num">{a.resolved}</td></tr>)}</tbody>
              </table>
            ) : <EmptyState title="No agents in this department" text="Add members to the department so requests can be assigned." />}
          </Card>
        </div>
      ))}
    </section>
  );
}

function System() {
  const q = useQuery({ queryKey: ["dash", "system"], queryFn: async () => (await get<SystemDash>("/api/dashboard/system")).data });
  if (q.isLoading) return <StatsSkeleton />;
  if (q.isError) return <Card title="System overview"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
  const d = q.data!;
  const status = Object.entries(d.tickets.byStatus).map(([k, v]) => ({ label: STATUS_LABEL[k as TicketStatus] ?? k, value: v }));
  const prio = Object.entries(d.tickets.byPriority).map(([k, v]) => ({ label: PRIORITY_LABEL[k as Priority] ?? k, value: v }));
  return (
    <section>
      <h2 className="mb-3 text-base">System overview</h2>
      <div className={`grid gap-4 ${d.users ? "grid-cols-6" : "grid-cols-3"}`}>
        <Stat label="All requests" value={d.tickets.total} />
        <Stat label="Open" value={d.tickets.open} tone={d.tickets.open ? "warn" : undefined} />
        <Stat label="Resolved" value={d.tickets.resolved} tone="ok" />
        {d.users && <><Stat label="Users" value={d.users.total} /><Stat label="Active users" value={d.users.active} /><Stat label="Support agents" value={d.users.supportAgents} /></>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title="By status"><BarList rows={status} /></Card>
        <Card title="By priority"><BarList rows={prio} color="bg-teal-fg" /></Card>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { can, user } = useAuth();
  const sections = [can(P.tViewAll) && "system", can(P.tViewDept) && "department", can(P.tViewAssigned) && "work", can(P.tViewOwn) && "mine"].filter(Boolean);
  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Signed in as ${fullName(user)}`} />
      <div className="space-y-8">
        {can(P.tViewAll) && <System />}
        {can(P.tViewDept) && <Department />}
        {can(P.tViewAssigned) && <MyWork />}
        {can(P.tViewOwn) && <MyRequests />}
        {!sections.length && <Card><EmptyState title="Nothing to show yet" text={can(...TICKET_VIEW) ? "" : "Your account has no dashboard permissions. Use the menu on the left for the areas you can open."} /></Card>}
      </div>
    </>
  );
}
