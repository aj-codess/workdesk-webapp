"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownUp, Plus } from "lucide-react";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDebounced, useUrlState } from "@/lib/hooks";
import { P, TICKET_VIEW } from "@/lib/permissions";
import { PRIORITIES, TICKET_STATUSES, type LookupDept, type TicketSummary } from "@/lib/types";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";
import { Button, Card, EmptyState, ErrorState, LinkButton, MultiSelect, PageHeader, Pagination, SearchBox, Select, Tabs, TableSkeleton } from "@/components/ui";
import { RequirePermission } from "@/components/permission";
import { TicketTable } from "@/components/tickets/ticket-table";
import type { Paged } from "@/lib/types";

const DEFAULTS = { view: "", q: "", status: "", priority: "", departmentId: "", agent: "", sort: "updatedAt", order: "desc", page: "1", limit: "20" };

function TicketsList() {
  const { can } = useAuth();
  const [f, setF] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const dSearch = useDebounced(search, 350);
  useEffect(() => { if (dSearch !== f.q) setF({ q: dSearch }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dSearch]);

  const views = useMemo(() => [
    { id: "all", label: "All requests", ok: can(P.tViewAll) },
    { id: "department", label: "My departments", ok: can(P.tViewDept) },
    { id: "assigned", label: "Assigned to me", ok: can(P.tViewAssigned) },
    { id: "mine", label: "My requests", ok: can(P.tViewOwn) },
  ].filter((v) => v.ok), [can]);
  const view = views.find((v) => v.id === f.view)?.id ?? views[0]?.id ?? "mine";
  const staff = view !== "mine";

  const depts = useQuery({ queryKey: ["lookup", "departments"], enabled: staff, staleTime: 120_000, queryFn: async () => (await get<LookupDept[]>("/api/lookups/departments")).data });

  const params = { view, search: f.q, status: f.status, priority: f.priority, departmentId: f.departmentId, assignedAgentId: f.agent, sort: f.sort, order: f.order, page: f.page, limit: f.limit };
  const q = useQuery({
    queryKey: ["tickets", params], placeholderData: keepPreviousData,
    queryFn: async () => { const r = await get<TicketSummary[]>("/api/tickets", params); return { data: r.data, meta: r.meta! } as Paged<TicketSummary>; },
  });

  const statusSel = f.status ? f.status.split(",") : [];
  const prioSel = f.priority ? f.priority.split(",") : [];
  const filtered = !!(f.q || f.status || f.priority || f.departmentId || f.agent);
  const presets = [
    can(P.tAccept) && { label: "Needs review", on: f.status === "PENDING_REVIEW,CLARIFICATION_REQUESTED", set: { status: "PENDING_REVIEW,CLARIFICATION_REQUESTED", agent: "" } },
    can(P.tAssign) && { label: "Accepted, unassigned", on: f.status === "ACCEPTED" && f.agent === "none", set: { status: "ACCEPTED", agent: "none" } },
  ].filter(Boolean) as { label: string; on: boolean; set: { status: string; agent: string } }[];

  return (
    <>
      <PageHeader title="Requests" subtitle={staff ? "Service requests you are allowed to see." : "Requests you have submitted."}
        actions={can(P.tCreate) ? <LinkButton href="/tickets/new" variant="primary"><Plus className="h-4 w-4" />New request</LinkButton> : null} />
      {views.length > 1 && <Tabs tabs={views.map((v) => ({ id: v.id, label: v.label }))} value={view} onChange={(id) => setF({ view: id })} />}
      <Card className={views.length > 1 ? "rounded-t-none border-t-0" : ""} flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <SearchBox className="w-64" value={search} onChange={setSearch} placeholder="Search title or reference" />
          <MultiSelect label="Status" value={statusSel} onChange={(v) => setF({ status: v.join(","), agent: "" })} options={TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
          <MultiSelect label="Priority" value={prioSel} onChange={(v) => setF({ priority: v.join(",") })} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
          {staff && (
            <Select className="!w-48" value={f.departmentId} onChange={(e) => setF({ departmentId: e.target.value })} aria-label="Department">
              <option value="">All departments</option>
              {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          )}
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant={p.on ? "primary" : "secondary"} onClick={() => (p.on ? setF({ status: "", agent: "" }) : setF(p.set))}>{p.label}</Button>
          ))}
          {filtered && <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setF({ q: "", status: "", priority: "", departmentId: "", agent: "" }); }}>Clear filters</Button>}
          <div className="ml-auto flex items-center gap-1.5">
            <Select className="!w-36" value={f.sort} onChange={(e) => setF({ sort: e.target.value })} aria-label="Sort by">
              <option value="updatedAt">Last updated</option><option value="createdAt">Date created</option><option value="priority">Priority</option><option value="status">Status</option><option value="number">Reference</option>
            </Select>
            <Button icon variant="secondary" onClick={() => setF({ order: f.order === "desc" ? "asc" : "desc" })} aria-label={`Sort ${f.order === "desc" ? "descending" : "ascending"}`} title={f.order === "desc" ? "Newest first" : "Oldest first"}><ArrowDownUp className="h-4 w-4" /></Button>
          </div>
        </div>
        {q.isLoading ? <TableSkeleton cols={6} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          q.data!.data.length === 0 ? (
            <EmptyState title={filtered ? "No requests match these filters" : "No requests yet"} text={filtered ? "Try removing a filter or searching for something else." : can(P.tCreate) ? "Create your first request to get started." : "Requests in your scope will show here."}
              action={filtered ? <Button onClick={() => { setSearch(""); setF({ q: "", status: "", priority: "", departmentId: "", agent: "" }); }}>Clear filters</Button> : can(P.tCreate) ? <LinkButton href="/tickets/new" variant="primary">New request</LinkButton> : undefined} />
          ) : (
            <div className={q.isFetching ? "opacity-70 transition-opacity" : ""}>
              <TicketTable rows={q.data!.data} showRequester={staff} />
              <Pagination meta={q.data!.meta} onPage={(p) => setF({ page: String(p) }, false)} onLimit={(n) => setF({ limit: String(n) })} />
            </div>
          )}
      </Card>
    </>
  );
}

export default function TicketsPage() {
  return <RequirePermission any={TICKET_VIEW}><Suspense><TicketsList /></Suspense></RequirePermission>;
}
