"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";
import { ApiError, del, get, patch, put } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { applyServerErrors } from "@/lib/forms";
import type { Paged, Permission, RoleDetail, UserSummary } from "@/lib/types";
import { fullName, humanize } from "@/lib/format";
import { ActiveBadge } from "@/components/badges";
import { Alert, Avatar, Badge, Button, Card, Checkbox, EmptyState, ErrorState, errorText, Field, Input, PageHeader, Pagination, Skeleton, Tabs, Textarea, TableSkeleton } from "@/components/ui";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";

function roleError(e: unknown) {
  if (e instanceof ApiError) {
    const m: Record<string, string> = {
      LAST_ADMIN_PROTECTED: "This change would leave nobody able to manage roles and users, so it was blocked.",
      ROLE_IN_USE: "This role is a system role or is still assigned to users. Remove it from them first.",
      PRIVILEGE_ESCALATION: "You can only grant permissions that you hold yourself.",
    };
    if (m[e.code]) return m[e.code]!;
  }
  return errorText(e);
}

/* ---- permission matrix ---- */
function Matrix({ role }: { role: RoleDetail }) {
  const { permissions: mine, can } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const editable = can(P.rolesAssignPermissions) && can(P.permissionsView);
  const cat = useQuery({ queryKey: ["permissions"], enabled: can(P.permissionsView), staleTime: 300_000, queryFn: async () => (await get<Permission[]>("/api/permissions")).data });
  const current = useMemo(() => new Set(role.permissions.map((p) => p.id)), [role.permissions]);
  const [sel, setSel] = useState<Set<string>>(current);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSel(new Set(current)); setError(null); }, [current]);

  const all = cat.data ?? role.permissions;
  const byModule = useMemo(() => {
    const m = new Map<string, Permission[]>();
    for (const p of all) m.set(p.module, [...(m.get(p.module) ?? []), p]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [all]);
  const keyOf = useMemo(() => new Map(all.map((p) => [p.id, p.key])), [all]);

  const added = [...sel].filter((id) => !current.has(id)), removed = [...current].filter((id) => !sel.has(id));
  const dirty = added.length + removed.length > 0;
  const save = useMutation({
    mutationFn: () => put<{ role: RoleDetail; added: string[]; removed: string[] }>(`/api/roles/${role.id}/permissions`, { permissionIds: [...sel] }),
    onSuccess: (r) => {
      qc.setQueryData(["role", role.id], r.data.role); qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success(`Permissions saved: ${r.data.added.length} added, ${r.data.removed.length} removed. Holders are affected on their next request.`);
    },
    onError: (e) => setError(roleError(e)),
  });
  const toggle = (id: string, on: boolean) => setSel((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  if (cat.isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="pb-16">
      {!editable && <Alert tone="info" className="mb-4">{can(P.rolesAssignPermissions) ? "Viewing the full catalogue needs the permissions.view permission, so only this role's permissions are listed." : "You can view this role but not change its permissions."}</Alert>}
      {role.isSystem && editable && <Alert tone="warn" className="mb-4">System role. Its name is fixed, and the permissions that let administrators manage roles and users cannot be removed from the System Administrator role.</Alert>}
      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}
      <div className="grid grid-cols-2 items-start gap-4">
        {byModule.map(([mod, perms]) => {
          const on = perms.filter((p) => sel.has(p.id)).length;
          const selectable = perms.filter((p) => sel.has(p.id) || mine.has(p.key));
          return (
            <Card key={mod} flush>
              <header className="flex items-center justify-between border-b border-line bg-[#F8F9FB] px-4 py-2.5">
                <h3 className="text-sm font-semibold">{humanize(mod)} <span className="ml-1 text-xs font-normal text-ink-3">{on} of {perms.length}</span></h3>
                {editable && <button className="text-xs text-brand-600 hover:underline" onClick={() => setSel((s) => { const n = new Set(s); const all = selectable.every((p) => n.has(p.id)); selectable.forEach((p) => (all ? n.delete(p.id) : n.add(p.id))); return n; })}>
                  {selectable.every((p) => sel.has(p.id)) ? "Clear all" : "Select all"}</button>}
              </header>
              <ul className="divide-y divide-line">
                {perms.map((p) => {
                  const locked = !editable || (!sel.has(p.id) && !mine.has(p.key));
                  const changed = sel.has(p.id) !== current.has(p.id);
                  return (
                    <li key={p.id} className={clsx("px-4 py-2", changed && "bg-brand-50")}>
                      <Checkbox disabled={locked} checked={sel.has(p.id)} onChange={(e) => toggle(p.id, e.target.checked)}
                        label={<span className="font-mono text-xs">{p.key}</span>} hint={!editable ? p.description : locked && !sel.has(p.id) ? `${p.description} (you do not hold this permission)` : p.description} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
      {editable && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 py-3 pl-[232px] backdrop-blur">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8">
            <p className="text-sm"><span className="font-medium">Unsaved changes.</span> <span className="text-ok-fg">{added.length} to add</span>, <span className="text-bad-fg">{removed.length} to remove</span>
              <span className="ml-2 text-xs text-ink-3">{[...added.map((i) => `+${keyOf.get(i)}`), ...removed.map((i) => `-${keyOf.get(i)}`)].slice(0, 4).join("  ")}{added.length + removed.length > 4 && "  ..."}</span></p>
            <div className="flex gap-2"><Button onClick={() => { setSel(new Set(current)); setError(null); }}>Discard</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save permissions</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Holders({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["role", id, "users", page], queryFn: async () => { const r = await get<UserSummary[]>(`/api/roles/${id}/users`, { page, limit: 20 }); return { data: r.data, meta: r.meta! } as Paged<UserSummary>; } });
  if (q.isLoading) return <TableSkeleton cols={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data!.data.length) return <EmptyState title="Nobody holds this role" text="Assign it from a user's page." />;
  return (
    <>
      <table className="tbl"><thead><tr><th>User</th><th>Department</th><th>Status</th></tr></thead>
        <tbody>{q.data!.data.map((u) => <tr key={u.id}><td><a href={`/users/${u.id}`} className="flex items-center gap-3 no-underline"><Avatar user={u} size={24} /><span className="font-medium text-ink">{fullName(u)}</span><span className="text-xs text-ink-3">{u.email}</span></a></td><td>{u.department?.name ?? "-"}</td><td><Badge tone={u.status === "ACTIVE" ? "ok" : "mute"}>{u.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></td></tr>)}</tbody></table>
      <Pagination meta={q.data!.meta} onPage={setPage} />
    </>
  );
}

const editSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(500).optional(), isActive: z.boolean() });
function EditDialog({ role, onClose }: { role: RoleDetail; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema), defaultValues: { name: role.name, description: role.description ?? "", isActive: role.isActive } });
  const m = useMutation({
    mutationFn: (v: z.infer<typeof editSchema>) => patch(`/api/roles/${role.id}`, { ...(role.isSystem ? {} : { name: v.name }), description: v.description || null, isActive: v.isActive }),
    onSuccess: () => { toast.success("Role saved"); qc.invalidateQueries({ queryKey: ["role", role.id] }); qc.invalidateQueries({ queryKey: ["roles"] }); onClose(); },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(roleError(e)); },
  });
  const err = form.formState.errors;
  return (
    <Modal open onClose={onClose} title="Edit role" footer={<><Button onClick={onClose}>Cancel</Button><Button type="submit" form="role-edit" variant="primary" loading={m.isPending}>Save</Button></>}>
      <form id="role-edit" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        {error && <Alert tone="bad">{error}</Alert>}
        <Field label="Name" required error={err.name?.message} hint={role.isSystem ? "The name of a system role cannot be changed." : undefined}><Input disabled={role.isSystem} invalid={!!err.name} {...form.register("name")} /></Field>
        <Field label="Description"><Textarea rows={3} {...form.register("description")} /></Field>
        <Checkbox label="Active" hint="Deactivating a role removes its permissions from everyone who holds it, right away." {...form.register("isActive")} />
      </form>
    </Modal>
  );
}

function Detail({ id }: { id: string }) {
  const { can } = useAuth(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast();
  const [tab, setTab] = useState<"permissions" | "users">("permissions");
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false);
  const q = useQuery({ queryKey: ["role", id], queryFn: async () => (await get<RoleDetail>(`/api/roles/${id}`)).data });
  const rm = useMutation({
    mutationFn: () => del(`/api/roles/${id}`),
    onSuccess: () => { toast.success("Role deleted"); qc.invalidateQueries({ queryKey: ["roles"] }); router.replace("/roles"); },
    onError: (e) => { setDeleting(false); toast.error(roleError(e)); },
  });
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-72" /><Skeleton className="h-64 w-full" /></div>;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
  const r = q.data;
  return (
    <>
      <PageHeader back={{ href: "/roles", label: "Roles and permissions" }}
        title={<span className="flex items-center gap-3">{r.name}{r.isSystem && <Badge tone="info">System</Badge>}<ActiveBadge active={r.isActive} /></span>}
        subtitle={`${r.description ? r.description + " · " : ""}${r.userCount} user${r.userCount === 1 ? "" : "s"}, ${r.permissionCount} permission${r.permissionCount === 1 ? "" : "s"}`}
        actions={<>{can(P.rolesUpdate) && <Button onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button>}{can(P.rolesDelete) && !r.isSystem && <Button variant="danger-outline" onClick={() => setDeleting(true)}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}</>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "permissions", label: "Permissions", count: r.permissionCount }, { id: "users", label: "Users", count: r.userCount, hidden: !can(P.usersView) }]} />
      <div className="mt-4">{tab === "permissions" ? <Matrix role={r} /> : <Card flush><Holders id={id} /></Card>}</div>
      {editing && <EditDialog role={r} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => rm.mutate()} loading={rm.isPending} danger confirmLabel="Delete role" title={`Delete ${r.name}?`}>A role can only be deleted when nobody holds it.</ConfirmDialog>
    </>
  );
}
export default function RolePage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <RequirePermission any={P.rolesView}><Detail id={id} /></RequirePermission>; }
