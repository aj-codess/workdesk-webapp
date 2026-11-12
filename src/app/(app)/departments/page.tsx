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
import type { Department, Paged } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { ActiveBadge } from "@/components/badges";
import { Alert, Button, Card, EmptyState, ErrorState, errorText, Field, Input, PageHeader, Pagination, SearchBox, Select, Textarea, TableSkeleton } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(120),
  code: z.string().trim().min(2, "At least 2 characters").max(20).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dash and underscore only"),
  description: z.string().max(1000).optional(),
});
type V = z.infer<typeof schema>;

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: "", code: "", description: "" } });
  useEffect(() => { if (open) { form.reset(); setError(null); } }, [open, form]);
  const m = useMutation({
    mutationFn: (v: V) => post<{ id: string }>("/api/departments", { ...v, description: v.description || undefined }),
    onSuccess: (r) => { toast.success("Department created"); qc.invalidateQueries({ queryKey: ["departments"] }); qc.invalidateQueries({ queryKey: ["lookup", "departments"] }); onClose(); router.push(`/departments/${r.data.id}`); },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(errorText(e)); },
  });
  const err = form.formState.errors;
  return (
    <Modal open={open} onClose={onClose} title="New department" footer={<><Button onClick={onClose}>Cancel</Button><Button type="submit" form="dept-form" variant="primary" loading={m.isPending}>Create department</Button></>}>
      <form id="dept-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        {error && <Alert tone="bad">{error}</Alert>}
        <Field label="Name" required error={err.name?.message}><Input invalid={!!err.name} {...form.register("name")} /></Field>
        <Field label="Code" required error={err.code?.message} hint="Short identifier such as IT or HR. Stored in capitals."><Input className="uppercase" invalid={!!err.code} {...form.register("code")} /></Field>
        <Field label="Description" error={err.description?.message}><Textarea rows={3} {...form.register("description")} /></Field>
      </form>
    </Modal>
  );
}

function List() {
  const { can } = useAuth(); const router = useRouter();
  const [f, setF] = useUrlState({ q: "", active: "", page: "1", limit: "20" });
  const [s, setS] = useState(f.q); const ds = useDebounced(s, 350);
  useEffect(() => { if (ds !== f.q) setF({ q: ds }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ds]);
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ["departments", f], placeholderData: keepPreviousData,
    queryFn: async () => { const r = await get<Department[]>("/api/departments", { search: f.q, isActive: f.active, page: f.page, limit: f.limit, sort: "name", order: "asc" }); return { data: r.data, meta: r.meta! } as Paged<Department>; },
  });
  return (
    <>
      <PageHeader title="Departments" subtitle="Teams that receive and handle requests." actions={can(P.deptCreate) && <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New department</Button>} />
      <Card flush>
        <div className="flex gap-2 border-b border-line px-3 py-2.5">
          <SearchBox className="w-64" value={s} onChange={setS} placeholder="Search name or code" />
          <Select className="!w-36" value={f.active} onChange={(e) => setF({ active: e.target.value })} aria-label="Status"><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></Select>
        </div>
        {q.isLoading ? <TableSkeleton cols={5} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.data.length ? <EmptyState title="No departments found" text={f.q || f.active ? "Try different filters." : "Create the first department to start receiving requests."} /> : (
          <>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Code</th><th className="num">Managers</th><th className="num">Members</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>{q.data!.data.map((d) => (
                <tr key={d.id} className="row-link" onClick={() => router.push(`/departments/${d.id}`)}>
                  <td className="font-medium text-ink">{d.name}{d.description && <span className="block max-w-md truncate text-xs font-normal text-ink-3">{d.description}</span>}</td>
                  <td className="font-mono text-xs">{d.code}</td><td className="num">{d.managerCount}</td><td className="num">{d.memberCount}</td>
                  <td><ActiveBadge active={d.isActive} /></td><td className="text-ink-3">{fmtDate(d.createdAt)}</td>
                </tr>))}</tbody>
            </table>
            <Pagination meta={q.data!.meta} onPage={(p) => setF({ page: String(p) }, false)} onLimit={(n) => setF({ limit: String(n) })} />
          </>
        )}
      </Card>
      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
export default function DepartmentsPage() { return <RequirePermission any={P.deptView}><Suspense><List /></Suspense></RequirePermission>; }
