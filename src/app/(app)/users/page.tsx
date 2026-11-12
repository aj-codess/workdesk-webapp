"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { get, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDebounced, useUrlState } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { applyServerErrors, PASSWORD_HELP, PASSWORD_RULE } from "@/lib/forms";
import type { LookupDept, LookupRole, Paged, UserDetail, UserSummary } from "@/lib/types";
import { fmtAgo, fullName } from "@/lib/format";
import { Alert, Avatar, Badge, Button, Card, Checkbox, EmptyState, ErrorState, errorText, Field, Input, PageHeader, Pagination, SearchBox, Select, TableSkeleton } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";
import { SecretReveal } from "@/components/secret-reveal";

const schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(100), lastName: z.string().trim().min(1, "Required").max(100),
  email: z.string().trim().min(1, "Required").email("Enter a valid email address"),
  jobTitle: z.string().max(120).optional(), departmentId: z.string().optional(),
  password: z.string().optional().refine((p) => !p || PASSWORD_RULE.test(p), PASSWORD_HELP),
  roleIds: z.array(z.string()), activate: z.boolean(), mustChangePassword: z.boolean(),
});
type V = z.infer<typeof schema>;

function CreateUser({ onClose }: { onClose: () => void }) {
  const { can } = useAuth(); const qc = useQueryClient(); const toast = useToast(); const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; temp?: string } | null>(null);
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "", email: "", jobTitle: "", departmentId: "", password: "", roleIds: [], activate: true, mustChangePassword: true } });
  const roles = useQuery({ queryKey: ["lookup", "roles"], enabled: can(P.usersAssignRoles), queryFn: async () => (await get<LookupRole[]>("/api/lookups/roles")).data });
  const depts = useQuery({ queryKey: ["lookup", "departments"], staleTime: 120_000, queryFn: async () => (await get<LookupDept[]>("/api/lookups/departments")).data });
  const m = useMutation({
    mutationFn: (v: V) => post<{ user: UserDetail; temporaryPassword?: string }>("/api/users", {
      email: v.email, firstName: v.firstName, lastName: v.lastName, jobTitle: v.jobTitle || undefined, departmentId: v.departmentId || undefined,
      password: v.password || undefined, mustChangePassword: v.mustChangePassword,
      ...(can(P.usersAssignRoles) && v.roleIds.length ? { roleIds: v.roleIds } : {}), ...(can(P.usersActivate) ? { activate: v.activate } : {}),
    }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("User created"); if (r.data.temporaryPassword) setCreated({ id: r.data.user.id, name: fullName(r.data.user), temp: r.data.temporaryPassword }); else { onClose(); router.push(`/users/${r.data.user.id}`); } },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(errorText(e)); },
  });
  const err = form.formState.errors;
  const picked = form.watch("roleIds");

  if (created) {
    return (
      <Modal open onClose={() => { onClose(); router.push(`/users/${created.id}`); }} title="User created" width="sm" dismissable={false}
        footer={<Button variant="primary" onClick={() => { onClose(); router.push(`/users/${created.id}`); }}>Open user</Button>}>
        <p className="mb-3 text-sm text-ink-2">Give {created.name} this temporary password. They must change it at first sign-in.</p>
        <SecretReveal value={created.temp!} />
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} title="New user" width="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button type="submit" form="user-form" variant="primary" loading={m.isPending}>Create user</Button></>}>
      <form id="user-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" required error={err.firstName?.message}><Input invalid={!!err.firstName} {...form.register("firstName")} /></Field>
          <Field label="Last name" required error={err.lastName?.message}><Input invalid={!!err.lastName} {...form.register("lastName")} /></Field>
        </div>
        <Field label="Work email" required error={err.email?.message}><Input type="email" invalid={!!err.email} {...form.register("email")} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Job title" error={err.jobTitle?.message}><Input {...form.register("jobTitle")} /></Field>
          <Field label="Department"><Select {...form.register("departmentId")}><option value="">None</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        </div>
        <Field label="Password" error={err.password?.message} hint="Leave empty to generate a temporary password."><Input type="password" autoComplete="new-password" invalid={!!err.password} {...form.register("password")} /></Field>
        {can(P.usersAssignRoles) && (
          <div>
            <span className="label">Roles</span>
            <div className="grid max-h-44 grid-cols-2 gap-x-4 gap-y-2 overflow-auto rounded border border-line p-3 scroll-thin">
              {roles.isLoading && <p className="text-sm text-ink-3">Loading roles</p>}
              {roles.data?.map((r) => (
                <Checkbox key={r.id} label={r.name} hint={r.assignable ? undefined : "You cannot grant this role"} disabled={!r.assignable} checked={picked.includes(r.id)}
                  onChange={(e) => form.setValue("roleIds", e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} />
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          {can(P.usersActivate) && <Checkbox label="Activate now" hint="Inactive accounts cannot sign in." {...form.register("activate")} />}
          <Checkbox label="Require a new password at first sign-in" {...form.register("mustChangePassword")} />
        </div>
      </form>
    </Modal>
  );
}

function List() {
  const { can } = useAuth(); const router = useRouter();
  const [f, setF] = useUrlState({ q: "", status: "", roleId: "", departmentId: "", sort: "createdAt", order: "desc", page: "1", limit: "20" });
  const [s, setS] = useState(f.q); const ds = useDebounced(s, 350);
  useEffect(() => { if (ds !== f.q) setF({ q: ds }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ds]);
  const [creating, setCreating] = useState(false);
  const roles = useQuery({ queryKey: ["lookup", "roles"], enabled: can(P.usersAssignRoles), queryFn: async () => (await get<LookupRole[]>("/api/lookups/roles")).data });
  const depts = useQuery({ queryKey: ["lookup", "departments"], staleTime: 120_000, queryFn: async () => (await get<LookupDept[]>("/api/lookups/departments")).data });
  const q = useQuery({
    queryKey: ["users", f], placeholderData: keepPreviousData,
    queryFn: async () => { const r = await get<UserSummary[]>("/api/users", { search: f.q, status: f.status, roleId: f.roleId, departmentId: f.departmentId, sort: f.sort, order: f.order, page: f.page, limit: f.limit }); return { data: r.data, meta: r.meta! } as Paged<UserSummary>; },
  });
  const filtered = !!(f.q || f.status || f.roleId || f.departmentId);
  return (
    <>
      <PageHeader title="Users" subtitle="People who can sign in to WorkDesk." actions={can(P.usersCreate) && <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New user</Button>} />
      <Card flush>
        <div className="flex flex-wrap gap-2 border-b border-line px-3 py-2.5">
          <SearchBox className="w-64" value={s} onChange={setS} placeholder="Search name or email" />
          <Select className="!w-36" value={f.status} onChange={(e) => setF({ status: e.target.value })} aria-label="Status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select>
          {roles.data && <Select className="!w-48" value={f.roleId} onChange={(e) => setF({ roleId: e.target.value })} aria-label="Role"><option value="">All roles</option>{roles.data.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}
          <Select className="!w-48" value={f.departmentId} onChange={(e) => setF({ departmentId: e.target.value })} aria-label="Department"><option value="">All departments</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setS(""); setF({ q: "", status: "", roleId: "", departmentId: "" }); }}>Clear filters</Button>}
          <Select className="ml-auto !w-40" value={f.sort} onChange={(e) => setF({ sort: e.target.value })} aria-label="Sort by"><option value="createdAt">Newest</option><option value="firstName">First name</option><option value="lastName">Last name</option><option value="email">Email</option><option value="lastLoginAt">Last sign-in</option></Select>
        </div>
        {q.isLoading ? <TableSkeleton cols={5} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.data.length ? <EmptyState title="No users found" text={filtered ? "Try different filters." : undefined} /> : (
          <>
            <table className="tbl">
              <thead><tr><th>User</th><th>Roles</th><th>Department</th><th>Status</th><th>Last sign-in</th></tr></thead>
              <tbody>{q.data!.data.map((u) => (
                <tr key={u.id} className="row-link" onClick={() => router.push(`/users/${u.id}`)}>
                  <td><div className="flex items-center gap-3"><Avatar user={u} /><div><p className="font-medium text-ink">{fullName(u)}</p><p className="text-xs text-ink-3">{u.email}</p></div></div></td>
                  <td><div className="flex flex-wrap gap-1">{u.roles.length ? u.roles.map((r) => <Badge key={r.id} tone="info">{r.name}</Badge>) : <span className="text-ink-4">No roles</span>}</div></td>
                  <td>{u.department?.name ?? <span className="text-ink-4">None</span>}</td>
                  <td><Badge tone={u.status === "ACTIVE" ? "ok" : "mute"}>{u.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></td>
                  <td className="text-ink-3">{u.lastLoginAt ? fmtAgo(u.lastLoginAt) : "Never"}</td>
                </tr>))}</tbody>
            </table>
            <Pagination meta={q.data!.meta} onPage={(p) => setF({ page: String(p) }, false)} onLimit={(n) => setF({ limit: String(n) })} />
          </>
        )}
      </Card>
      {creating && <CreateUser onClose={() => setCreating(false)} />}
    </>
  );
}
export default function UsersPage() { return <RequirePermission any={P.usersView}><Suspense><List /></Suspense></RequirePermission>; }
