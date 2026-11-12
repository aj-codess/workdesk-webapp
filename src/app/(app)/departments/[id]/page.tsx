"use client";
import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError, del, get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDebounced } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { applyServerErrors } from "@/lib/forms";
import type { Category, DepartmentDetail, DepartmentMember, Paged, UserRef } from "@/lib/types";
import { fmtDate, fullName } from "@/lib/format";
import { ActiveBadge } from "@/components/badges";
import { Alert, Avatar, Badge, Button, Card, Checkbox, EmptyState, ErrorState, errorText, Field, Input, PageHeader, Pagination, SearchBox, Skeleton, Tabs, Textarea, TableSkeleton } from "@/components/ui";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";

/* ---- user picker used for managers and members ---- */
function UserPicker({ title, multiple, exclude, onClose, onPick, busy, error }: { title: string; multiple: boolean; exclude: string[]; onClose: () => void; onPick: (ids: string[]) => void; busy: boolean; error: string | null }) {
  const [s, setS] = useState(""); const ds = useDebounced(s, 300);
  const [sel, setSel] = useState<string[]>([]);
  const q = useQuery({ queryKey: ["lookup", "users", ds], enabled: ds.trim().length >= 2, queryFn: async () => (await get<UserRef[]>("/api/lookups/users", { search: ds.trim(), limit: 20 })).data });
  const rows = (q.data ?? []).filter((u) => !exclude.includes(u.id));
  return (
    <Modal open onClose={onClose} title={title} description="Search active users by name or email."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!sel.length} onClick={() => onPick(sel)}>{multiple ? `Add ${sel.length || ""} selected`.trim() : "Add"}</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="bad">{error}</Alert>}
        <SearchBox value={s} onChange={setS} placeholder="Type at least 2 characters" />
        <div className="max-h-64 overflow-auto rounded border border-line scroll-thin">
          {ds.trim().length < 2 ? <p className="px-3 py-6 text-center text-sm text-ink-3">Start typing to find people.</p>
            : q.isLoading ? <p className="px-3 py-6 text-center text-sm text-ink-3">Searching</p>
            : !rows.length ? <p className="px-3 py-6 text-center text-sm text-ink-3">No matching active users.</p>
            : <ul className="divide-y divide-line">{rows.map((u) => (
              <li key={u.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-canvas">
                <input type={multiple ? "checkbox" : "radio"} name="pick" className="check" checked={sel.includes(u.id)} onChange={() => setSel((c) => (multiple ? (c.includes(u.id) ? c.filter((x) => x !== u.id) : [...c, u.id]) : [u.id]))} />
                <Avatar user={u} size={24} /><span className="text-sm">{fullName(u)}<span className="ml-2 text-xs text-ink-3">{u.email}</span></span>
              </label></li>))}</ul>}
        </div>
      </div>
    </Modal>
  );
}

/* ---- tabs ---- */
function Managers({ dept }: { dept: DepartmentDetail }) {
  const { can } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const [adding, setAdding] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UserRef | null>(null);
  const edit = can(P.deptMembers);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["department", dept.id] }); qc.invalidateQueries({ queryKey: ["departments"] }); };
  const add = useMutation({
    mutationFn: (userId: string) => post<{ managers: UserRef[]; warnings?: string[] }>(`/api/departments/${dept.id}/managers`, { userId }),
    onSuccess: (r) => { setAdding(false); invalidate(); toast.success("Manager added"); (r.data.warnings ?? []).forEach((w) => toast.info(w)); },
    onError: (e) => setErr(errorText(e)),
  });
  const rm = useMutation({
    mutationFn: (id: string) => del(`/api/departments/${dept.id}/managers/${id}`),
    onSuccess: () => { setRemoving(null); invalidate(); toast.success("Manager removed"); },
    onError: (e) => { setRemoving(null); toast.error(errorText(e)); },
  });
  return (
    <Card title="Managers" actions={edit && <Button size="sm" variant="primary" onClick={() => { setErr(null); setAdding(true); }}><Plus className="h-3.5 w-3.5" />Add manager</Button>} flush>
      <p className="border-b border-line px-4 py-2.5 text-xs text-ink-3">Managers review incoming requests and assign them. They also need a role that grants the ticket permissions.</p>
      {!dept.managers.length ? <EmptyState title="No managers" text="Requests to this department cannot be reviewed until a manager is added." /> : (
        <ul className="divide-y divide-line">{dept.managers.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-2.5"><Avatar user={m} /><div className="flex-1 text-sm"><p className="font-medium">{fullName(m)}</p><p className="text-xs text-ink-3">{m.email}</p></div>
            {edit && <Button size="sm" variant="ghost" icon aria-label={`Remove ${fullName(m)}`} onClick={() => setRemoving(m)}><Trash2 className="h-4 w-4" /></Button>}</li>))}</ul>
      )}
      {adding && <UserPicker title="Add a manager" multiple={false} exclude={dept.managers.map((m) => m.id)} onClose={() => setAdding(false)} busy={add.isPending} error={err} onPick={(ids) => add.mutate(ids[0]!)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && rm.mutate(removing.id)} loading={rm.isPending} danger confirmLabel="Remove" title="Remove this manager?">
        {removing && fullName(removing)} will no longer see this department&apos;s review queue.
      </ConfirmDialog>
    </Card>
  );
}

function Members({ dept }: { dept: DepartmentDetail }) {
  const { can } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const [page, setPage] = useState(1); const [s, setS] = useState(""); const ds = useDebounced(s, 300);
  const [adding, setAdding] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DepartmentMember | null>(null);
  const edit = can(P.deptMembers);
  useEffect(() => setPage(1), [ds]);
  const q = useQuery({ queryKey: ["department", dept.id, "members", page, ds], queryFn: async () => { const r = await get<DepartmentMember[]>(`/api/departments/${dept.id}/members`, { page, limit: 20, search: ds }); return { data: r.data, meta: r.meta! } as Paged<DepartmentMember>; } });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["department", dept.id] }); qc.invalidateQueries({ queryKey: ["departments"] }); };
  const add = useMutation({
    mutationFn: (userIds: string[]) => post<{ added: number; skipped: number }>(`/api/departments/${dept.id}/members`, { userIds }),
    onSuccess: (r) => { setAdding(false); invalidate(); toast.success(`${r.data.added} member${r.data.added === 1 ? "" : "s"} added${r.data.skipped ? `, ${r.data.skipped} already in the team` : ""}`); },
    onError: (e) => setErr(errorText(e)),
  });
  const rm = useMutation({
    mutationFn: (id: string) => del(`/api/departments/${dept.id}/members/${id}`),
    onSuccess: () => { setRemoving(null); invalidate(); toast.success("Member removed"); },
    onError: (e) => { setRemoving(null); toast.error(e instanceof ApiError && e.code === "HAS_OPEN_ASSIGNMENTS" ? "This person still has open requests in this department. Reassign them first." : errorText(e)); },
  });
  return (
    <Card title="Members" actions={edit && <Button size="sm" variant="primary" onClick={() => { setErr(null); setAdding(true); }}><Plus className="h-3.5 w-3.5" />Add members</Button>} flush>
      <p className="border-b border-line px-4 py-2.5 text-xs text-ink-3">Members are the people requests can be assigned to. An agent also needs a role that grants assigned-request access.</p>
      <div className="border-b border-line px-3 py-2.5"><SearchBox className="w-64" value={s} onChange={setS} placeholder="Search members" /></div>
      {q.isLoading ? <TableSkeleton cols={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.data.length ? <EmptyState title={ds ? "No members match" : "No members yet"} text={ds ? "" : "Add the agents who work on this department's requests."} /> : (
        <>
          <table className="tbl"><thead><tr><th>Person</th><th>Added</th><th className="num">Open requests</th>{edit && <th />}</tr></thead>
            <tbody>{q.data!.data.map((m) => (
              <tr key={m.user.id}><td><span className="font-medium text-ink">{fullName(m.user)}</span><span className="ml-2 text-xs text-ink-3">{m.user.email}</span></td><td className="text-ink-3">{fmtDate(m.addedAt)}</td><td className="num">{m.openTickets}</td>
                {edit && <td className="text-right"><Button size="sm" variant="ghost" icon aria-label={`Remove ${fullName(m.user)}`} onClick={() => setRemoving(m)}><Trash2 className="h-4 w-4" /></Button></td>}</tr>))}</tbody></table>
          <Pagination meta={q.data!.meta} onPage={setPage} />
        </>
      )}
      {adding && <UserPicker title="Add members" multiple exclude={q.data?.data.map((m) => m.user.id) ?? []} onClose={() => setAdding(false)} busy={add.isPending} error={err} onPick={(ids) => add.mutate(ids)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && rm.mutate(removing.user.id)} loading={rm.isPending} danger confirmLabel="Remove" title="Remove this member?">
        {removing && fullName(removing.user)} will no longer be offered when assigning requests.
      </ConfirmDialog>
    </Card>
  );
}

const catSchema = z.object({ name: z.string().trim().min(2, "At least 2 characters").max(120), description: z.string().max(500).optional(), isSensitive: z.boolean(), isActive: z.boolean() });
type CatV = z.infer<typeof catSchema>;

function CategoryDialog({ dept, cat, onClose }: { dept: DepartmentDetail; cat: Category | "new"; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const [error, setError] = useState<string | null>(null);
  const isNew = cat === "new";
  const form = useForm<CatV>({ resolver: zodResolver(catSchema), defaultValues: { name: isNew ? "" : cat.name, description: isNew ? "" : cat.description ?? "", isSensitive: isNew ? false : cat.isSensitive, isActive: isNew ? true : cat.isActive } });
  const m = useMutation({
    mutationFn: (v: CatV) => isNew ? post("/api/categories", { departmentId: dept.id, name: v.name, description: v.description || undefined, isSensitive: v.isSensitive })
      : patch(`/api/categories/${cat.id}`, { name: v.name, description: v.description || null, isSensitive: v.isSensitive, isActive: v.isActive }),
    onSuccess: () => { toast.success(isNew ? "Category created" : "Category saved"); qc.invalidateQueries({ queryKey: ["categories", dept.id] }); qc.invalidateQueries({ queryKey: ["lookup", "categories"] }); onClose(); },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(errorText(e)); },
  });
  const err = form.formState.errors;
  return (
    <Modal open onClose={onClose} title={isNew ? "New category" : "Edit category"} footer={<><Button onClick={onClose}>Cancel</Button><Button type="submit" form="cat-form" variant="primary" loading={m.isPending}>{isNew ? "Create category" : "Save"}</Button></>}>
      <form id="cat-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        {error && <Alert tone="bad">{error}</Alert>}
        <Field label="Name" required error={err.name?.message}><Input invalid={!!err.name} {...form.register("name")} /></Field>
        <Field label="Description" error={err.description?.message}><Textarea rows={2} {...form.register("description")} /></Field>
        <Checkbox label="Sensitive" hint="Flags requests that may contain confidential information." {...form.register("isSensitive")} />
        {!isNew && <Checkbox label="Active" hint="Inactive categories cannot be chosen for new requests." {...form.register("isActive")} />}
      </form>
    </Modal>
  );
}

function Categories({ dept }: { dept: DepartmentDetail }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const q = useQuery({ queryKey: ["categories", dept.id], enabled: can(P.catView), queryFn: async () => (await get<Category[]>("/api/categories", { departmentId: dept.id, limit: 100 })).data });
  const manage = can(P.catManage);
  return (
    <Card title="Categories" actions={manage && <Button size="sm" variant="primary" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" />New category</Button>} flush>
      {q.isLoading ? <TableSkeleton cols={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title="No categories" text="Requesters choose a category when they submit a request." /> : (
        <table className="tbl"><thead><tr><th>Name</th><th>Status</th><th>Flags</th>{manage && <th />}</tr></thead>
          <tbody>{q.data.map((c) => (
            <tr key={c.id}><td className="font-medium text-ink">{c.name}{c.description && <span className="block text-xs font-normal text-ink-3">{c.description}</span>}</td>
              <td><ActiveBadge active={c.isActive} /></td><td>{c.isSensitive && <Badge tone="warn">Sensitive</Badge>}</td>
              {manage && <td className="text-right"><Button size="sm" variant="ghost" icon aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button></td>}</tr>))}</tbody></table>
      )}
      {editing && <CategoryDialog dept={dept} cat={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const editSchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dash and underscore only"), description: z.string().max(1000).optional(), isActive: z.boolean() });
function EditDialog({ dept, onClose }: { dept: DepartmentDetail; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema), defaultValues: { name: dept.name, code: dept.code, description: dept.description ?? "", isActive: dept.isActive } });
  const m = useMutation({
    mutationFn: (v: z.infer<typeof editSchema>) => patch(`/api/departments/${dept.id}`, { ...v, description: v.description || null }),
    onSuccess: () => { toast.success("Department saved"); qc.invalidateQueries({ queryKey: ["department", dept.id] }); qc.invalidateQueries({ queryKey: ["departments"] }); qc.invalidateQueries({ queryKey: ["lookup", "departments"] }); onClose(); },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(errorText(e)); },
  });
  const err = form.formState.errors;
  return (
    <Modal open onClose={onClose} title="Edit department" footer={<><Button onClick={onClose}>Cancel</Button><Button type="submit" form="dept-edit" variant="primary" loading={m.isPending}>Save</Button></>}>
      <form id="dept-edit" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        {error && <Alert tone="bad">{error}</Alert>}
        <Field label="Name" required error={err.name?.message}><Input invalid={!!err.name} {...form.register("name")} /></Field>
        <Field label="Code" required error={err.code?.message}><Input className="uppercase" invalid={!!err.code} {...form.register("code")} /></Field>
        <Field label="Description"><Textarea rows={3} {...form.register("description")} /></Field>
        <Checkbox label="Active" hint="Inactive departments no longer receive new requests. Existing requests continue." {...form.register("isActive")} />
      </form>
    </Modal>
  );
}

function Detail({ id }: { id: string }) {
  const { can } = useAuth();
  const [tab, setTab] = useState<"managers" | "members" | "categories">("managers");
  const [editing, setEditing] = useState(false);
  const q = useQuery({ queryKey: ["department", id], queryFn: async () => (await get<DepartmentDetail>(`/api/departments/${id}`)).data });
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-7 w-72" /><Skeleton className="h-48 w-full" /></div>;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
  const d = q.data;
  return (
    <>
      <PageHeader back={{ href: "/departments", label: "Departments" }} title={<span className="flex items-center gap-3">{d.name}<span className="font-mono text-sm font-normal text-ink-3">{d.code}</span><ActiveBadge active={d.isActive} /></span>}
        subtitle={d.description ?? undefined} actions={can(P.deptUpdate) && <Button onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "managers", label: "Managers", count: d.managerCount }, { id: "members", label: "Members", count: d.memberCount }, { id: "categories", label: "Categories", hidden: !can(P.catView) }]} />
      <div className="mt-4">
        {tab === "managers" && <Managers dept={d} />}
        {tab === "members" && <Members dept={d} />}
        {tab === "categories" && <Categories dept={d} />}
      </div>
      {editing && <EditDialog dept={d} onClose={() => setEditing(false)} />}
    </>
  );
}
export default function DepartmentPage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <RequirePermission any={P.deptView}><Detail id={id} /></RequirePermission>; }
