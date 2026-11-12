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
import { applyServerErrors } from "@/lib/forms";
import type { Paged, Role, RoleDetail } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { ActiveBadge } from "@/components/badges";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, errorText, Field, Input, PageHeader, Pagination, SearchBox, Select, Textarea, TableSkeleton } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";

const schema = z.object({ name: z.string().trim().min(2, "At least 2 characters").max(80), description: z.string().max(500).optional() });
function CreateRole({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const router = useRouter(); const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "" } });
  const m = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => post<RoleDetail>("/api/roles", { name: v.name, description: v.description || undefined }),
    onSuccess: (r) => { toast.success("Role created. Now choose its permissions."); qc.invalidateQueries({ queryKey: ["roles"] }); onClose(); router.push(`/roles/${r.data.id}`); },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(errorText(e)); },
  });
  const err = form.formState.errors;
  return (
    <Modal open onClose={onClose} title="New role" description="Create the role first, then choose what it can do." footer={<><Button onClick={onClose}>Cancel</Button><Button type="submit" form="role-form" variant="primary" loading={m.isPending}>Create role</Button></>}>
      <form id="role-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        {error && <Alert tone="bad">{error}</Alert>}
        <Field label="Role name" required error={err.name?.message}><Input invalid={!!err.name} placeholder="e.g. Read-only auditor" {...form.register("name")} /></Field>
        <Field label="Description" error={err.description?.message}><Textarea rows={3} {...form.register("description")} /></Field>
      </form>
    </Modal>
  );
}

function List() {
  const { can } = useAuth(); const router = useRouter();
  const [f, setF] = useUrlState({ q: "", active: "", sort: "name", order: "asc", page: "1", limit: "20" });
  const [s, setS] = useState(f.q); const ds = useDebounced(s, 350);
  useEffect(() => { if (ds !== f.q) setF({ q: ds }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ds]);
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ["roles", f], placeholderData: keepPreviousData,
    queryFn: async () => { const r = await get<Role[]>("/api/roles", { search: f.q, isActive: f.active, sort: f.sort, order: f.order, page: f.page, limit: f.limit }); return { data: r.data, meta: r.meta! } as Paged<Role>; },
  });
  return (
    <>
      <PageHeader title="Roles and permissions" subtitle="Roles bundle permissions. Users hold any number of roles and get the combined access." actions={can(P.rolesCreate) && <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New role</Button>} />
      <Card flush>
        <div className="flex gap-2 border-b border-line px-3 py-2.5">
          <SearchBox className="w-64" value={s} onChange={setS} placeholder="Search roles" />
          <Select className="!w-36" value={f.active} onChange={(e) => setF({ active: e.target.value })} aria-label="Status"><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></Select>
          <Select className="ml-auto !w-40" value={f.sort} onChange={(e) => setF({ sort: e.target.value })} aria-label="Sort by"><option value="name">Name</option><option value="createdAt">Newest</option><option value="userCount">Most users</option></Select>
        </div>
        {q.isLoading ? <TableSkeleton cols={5} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.data.length ? <EmptyState title="No roles found" /> : (
          <>
            <table className="tbl">
              <thead><tr><th>Role</th><th className="num">Permissions</th><th className="num">Users</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>{q.data!.data.map((r) => (
                <tr key={r.id} className="row-link" onClick={() => router.push(`/roles/${r.id}`)}>
                  <td className="font-medium text-ink">{r.name} {r.isSystem && <Badge tone="info" className="ml-1.5">System</Badge>}{r.description && <span className="block max-w-lg truncate text-xs font-normal text-ink-3">{r.description}</span>}</td>
                  <td className="num">{r.permissionCount}</td><td className="num">{r.userCount}</td><td><ActiveBadge active={r.isActive} /></td><td className="text-ink-3">{fmtDate(r.createdAt)}</td>
                </tr>))}</tbody>
            </table>
            <Pagination meta={q.data!.meta} onPage={(p) => setF({ page: String(p) }, false)} onLimit={(n) => setF({ limit: String(n) })} />
          </>
        )}
      </Card>
      {creating && <CreateRole onClose={() => setCreating(false)} />}
    </>
  );
}
export default function RolesPage() { return <RequirePermission any={P.rolesView}><Suspense><List /></Suspense></RequirePermission>; }
