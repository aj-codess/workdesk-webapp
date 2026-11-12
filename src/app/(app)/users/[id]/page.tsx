"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, ShieldCheck, Trash2, UserX } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError, del, get, patch, post, put } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { applyServerErrors, PASSWORD_HELP, PASSWORD_RULE } from "@/lib/forms";
import type { LookupDept, LookupRole, SessionRow, UserDetail } from "@/lib/types";
import { fmtAgo, fmtDateTime, fullName } from "@/lib/format";
import { Alert, Avatar, Badge, Button, Card, Checkbox, ErrorState, errorText, Field, Input, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";
import { SecretReveal } from "@/components/secret-reveal";
import { SessionList } from "@/components/session-list";

function businessError(e: unknown): string {
  if (e instanceof ApiError) {
    const m: Record<string, string> = {
      LAST_ADMIN_PROTECTED: "This would leave the system without an active administrator, so it was blocked.",
      CANNOT_MODIFY_SELF: "You cannot do this to your own account.",
      HAS_OPEN_ASSIGNMENTS: "This person still holds open requests. Reassign them first.",
      PRIVILEGE_ESCALATION: "You can only grant roles whose permissions you hold yourself.",
    };
    if (m[e.code]) return m[e.code]!;
  }
  return errorText(e);
}

const editSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(100), lastName: z.string().trim().min(1, "Required").max(100),
  email: z.string().trim().email("Enter a valid email address"), phone: z.string().max(30).optional(), jobTitle: z.string().max(120).optional(),
  departmentId: z.string().optional(), mustChangePassword: z.boolean(),
});
function EditDialog({ u, onClose }: { u: UserDetail; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const [error, setError] = useState<string | null>(null);
  const depts = useQuery({ queryKey: ["lookup", "departments"], staleTime: 120_000, queryFn: async () => (await get<LookupDept[]>("/api/lookups/departments")).data });
  const form = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema), defaultValues: { firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone ?? "", jobTitle: u.jobTitle ?? "", departmentId: u.department?.id ?? "", mustChangePassword: u.mustChangePassword } });
  const m = useMutation({
    mutationFn: (v: z.infer<typeof editSchema>) => patch(`/api/users/${u.id}`, { ...v, phone: v.phone || null, jobTitle: v.jobTitle || null, departmentId: v.departmentId || null }),
    onSuccess: () => { toast.success("User saved"); qc.invalidateQueries({ queryKey: ["user", u.id] }); qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(errorText(e)); },
  });
  const err = form.formState.errors;
  return (
    <Modal open onClose={onClose} title="Edit user" width="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button type="submit" form="u-edit" variant="primary" loading={m.isPending}>Save</Button></>}>
      <form id="u-edit" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" required error={err.firstName?.message}><Input invalid={!!err.firstName} {...form.register("firstName")} /></Field>
          <Field label="Last name" required error={err.lastName?.message}><Input invalid={!!err.lastName} {...form.register("lastName")} /></Field>
        </div>
        <Field label="Email" required error={err.email?.message}><Input type="email" invalid={!!err.email} {...form.register("email")} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone"><Input {...form.register("phone")} /></Field><Field label="Job title"><Input {...form.register("jobTitle")} /></Field>
        </div>
        <Field label="Department"><Select {...form.register("departmentId")}><option value="">None</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Checkbox label="Require a new password at next sign-in" {...form.register("mustChangePassword")} />
      </form>
    </Modal>
  );
}

function RolesDialog({ u, onClose }: { u: UserDetail; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const [error, setError] = useState<string | null>(null);
  const roles = useQuery({ queryKey: ["lookup", "roles"], queryFn: async () => (await get<LookupRole[]>("/api/lookups/roles")).data });
  const [sel, setSel] = useState<string[]>(u.roles.map((r) => r.id));
  const m = useMutation({
    mutationFn: () => put(`/api/users/${u.id}/roles`, { roleIds: sel }),
    onSuccess: () => { toast.success("Roles updated. They apply on the user's next request."); qc.invalidateQueries({ queryKey: ["user", u.id] }); qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["roles"] }); onClose(); },
    onError: (e) => setError(businessError(e)),
  });
  const original = new Set(u.roles.map((r) => r.id));
  const changed = sel.length !== original.size || sel.some((id) => !original.has(id));
  return (
    <Modal open onClose={onClose} title="Assign roles" description={`A user's access is the combination of every role they hold.`} width="md"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending} disabled={!changed} onClick={() => m.mutate()}>Save roles</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="bad">{error}</Alert>}
        {roles.isLoading ? <Skeleton className="h-24 w-full" /> : roles.isError ? <ErrorState error={roles.error} /> : (
          <div className="max-h-80 space-y-1 overflow-auto rounded border border-line p-2 scroll-thin">
            {roles.data!.map((r) => {
              const had = original.has(r.id);
              const disabled = !r.assignable && !had;
              return (
                <div key={r.id} className="rounded px-2 py-1.5 hover:bg-canvas">
                  <Checkbox label={r.name} disabled={disabled} checked={sel.includes(r.id)} hint={disabled ? "Contains permissions you do not hold" : r.description ?? undefined}
                    onChange={(e) => setSel((c) => (e.target.checked ? [...c, r.id] : c.filter((x) => x !== r.id)))} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ResetPasswordDialog({ u, onClose }: { u: UserDetail; onClose: () => void }) {
  const qc = useQueryClient(); const [error, setError] = useState<string | null>(null); const [pw, setPw] = useState(""); const [temp, setTemp] = useState<string | null>(null); const [done, setDone] = useState(false);
  const bad = pw.length > 0 && !PASSWORD_RULE.test(pw);
  const m = useMutation({
    mutationFn: () => post<{ temporaryPassword?: string }>(`/api/users/${u.id}/reset-password`, pw ? { newPassword: pw } : {}),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["user", u.id] }); setDone(true); setTemp(r.data?.temporaryPassword ?? null); },
    onError: (e) => setError(businessError(e)),
  });
  if (done) return (
    <Modal open onClose={onClose} title="Password reset" width="sm" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-sm text-ink-2">{fullName(u)} was signed out everywhere and must choose a new password at next sign-in.</p>
      {temp ? <SecretReveal value={temp} /> : <p className="text-sm text-ink-3">They sign in with the password you entered.</p>}
    </Modal>
  );
  return (
    <Modal open onClose={onClose} title="Reset password" description={`Set a new password for ${fullName(u)}. All of their sessions end.`} width="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending} disabled={bad} onClick={() => m.mutate()}>Reset password</Button></>}>
      <div className="space-y-3">{error && <Alert tone="bad">{error}</Alert>}
        <Field label="New password" hint={bad ? undefined : "Leave empty to generate a temporary password."} error={bad ? PASSWORD_HELP : undefined}><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={bad} /></Field></div>
    </Modal>
  );
}

function Detail({ id }: { id: string }) {
  const { user: me, can } = useAuth(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast();
  const [dlg, setDlg] = useState<"edit" | "roles" | "reset" | "deactivate" | "delete" | "revoke" | null>(null);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["user", id], queryFn: async () => (await get<UserDetail>(`/api/users/${id}`)).data });
  const sessions = useQuery({ queryKey: ["user", id, "sessions"], enabled: can(P.usersRevokeSessions), queryFn: async () => (await get<SessionRow[]>(`/api/users/${id}/sessions`)).data });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["user", id] }); qc.invalidateQueries({ queryKey: ["users"] }); };
  const act = useMutation({
    mutationFn: async (a: "activate" | "deactivate" | "delete" | "revoke") => {
      if (a === "activate") return post(`/api/users/${id}/activate`);
      if (a === "deactivate") return post(`/api/users/${id}/deactivate`, reason.trim() ? { reason: reason.trim() } : {});
      if (a === "revoke") return del(`/api/users/${id}/sessions`);
      return del(`/api/users/${id}`);
    },
    onSuccess: (_r, a) => {
      setDlg(null); setReason(""); refresh(); qc.invalidateQueries({ queryKey: ["user", id, "sessions"] });
      toast.success({ activate: "User activated", deactivate: "User deactivated and signed out", revoke: "All sessions ended", delete: "User deleted" }[a]);
      if (a === "delete") router.replace("/users");
    },
    onError: (e) => { setDlg(null); toast.error(businessError(e)); },
  });

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-72" /><Skeleton className="h-56 w-full" /></div>;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
  const u = q.data; const self = u.id === me?.id; const active = u.status === "ACTIVE";
  return (
    <>
      <PageHeader back={{ href: "/users", label: "Users" }}
        title={<span className="flex items-center gap-3"><Avatar user={u} size={36} />{fullName(u)}<Badge tone={active ? "ok" : "mute"}>{active ? "Active" : "Inactive"}</Badge>{self && <Badge tone="info">You</Badge>}</span>}
        subtitle={u.email} actions={can(P.usersUpdate) && <Button onClick={() => setDlg("edit")}><Pencil className="h-3.5 w-3.5" />Edit</Button>} />
      {u.mustChangePassword && <Alert tone="warn" className="mb-4">This user must choose a new password at next sign-in.</Alert>}
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6">
        <div className="space-y-5">
          <Card title="Roles and access" actions={can(P.usersAssignRoles) && !self && <Button size="sm" onClick={() => setDlg("roles")}><ShieldCheck className="h-3.5 w-3.5" />Assign roles</Button>}>
            {u.roles.length ? <div className="flex flex-wrap gap-2">{u.roles.map((r) => <Badge key={r.id} tone="info">{r.name}</Badge>)}</div> : <p className="text-sm text-ink-3">No roles. This user can sign in but cannot open anything.</p>}
            {self && can(P.usersAssignRoles) && <p className="mt-3 text-xs text-ink-3">You cannot change your own roles.</p>}
            {(u.managedDepartments.length > 0 || u.memberDepartments.length > 0) && (
              <dl className="kv mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
                <div><dt>Manages</dt><dd className="!mb-0">{u.managedDepartments.length ? u.managedDepartments.map((d) => d.name).join(", ") : "-"}</dd></div>
                <div><dt>Team member of</dt><dd className="!mb-0">{u.memberDepartments.length ? u.memberDepartments.map((d) => d.name).join(", ") : "-"}</dd></div>
              </dl>
            )}
          </Card>
          {can(P.usersRevokeSessions) && (
            <Card title="Active sessions" actions={sessions.data?.length ? <Button size="sm" variant="danger-outline" onClick={() => setDlg("revoke")}>End all sessions</Button> : null} flush>
              {sessions.isLoading ? <Skeleton className="m-4 h-12" /> : sessions.isError ? <ErrorState error={sessions.error} /> : <SessionList rows={sessions.data!} />}
            </Card>
          )}
        </div>
        <aside className="space-y-5">
          <Card title="Profile">
            <dl className="kv">
              <dt>Department</dt><dd>{u.department?.name ?? "-"}</dd><dt>Job title</dt><dd>{u.jobTitle ?? "-"}</dd><dt>Phone</dt><dd>{u.phone ?? "-"}</dd>
              <dt>Last sign-in</dt><dd title={fmtDateTime(u.lastLoginAt)}>{u.lastLoginAt ? fmtAgo(u.lastLoginAt) : "Never"}</dd>
              <dt>Created</dt><dd className="!mb-0">{fmtDateTime(u.createdAt)}</dd>
              {u.deactivatedAt && <><dt className="mt-3">Deactivated</dt><dd className="!mb-0">{fmtDateTime(u.deactivatedAt)}</dd></>}
            </dl>
          </Card>
          {(can(P.usersActivate, P.usersUpdate, P.usersDelete)) && (
            <Card title="Account actions">
              <div className="space-y-2">
                {can(P.usersActivate) && (active
                  ? <Button className="w-full" disabled={self} onClick={() => setDlg("deactivate")}><UserX className="h-3.5 w-3.5" />Deactivate</Button>
                  : <Button className="w-full" variant="primary" loading={act.isPending} onClick={() => act.mutate("activate")}>Activate account</Button>)}
                {can(P.usersUpdate) && <Button className="w-full" disabled={self} onClick={() => setDlg("reset")}><KeyRound className="h-3.5 w-3.5" />Reset password</Button>}
                {can(P.usersDelete) && <Button className="w-full" variant="danger-outline" disabled={self} onClick={() => setDlg("delete")}><Trash2 className="h-3.5 w-3.5" />Delete user</Button>}
                {self && <p className="text-xs text-ink-3">These actions are not available on your own account.</p>}
              </div>
            </Card>
          )}
        </aside>
      </div>

      {dlg === "edit" && <EditDialog u={u} onClose={() => setDlg(null)} />}
      {dlg === "roles" && <RolesDialog u={u} onClose={() => setDlg(null)} />}
      {dlg === "reset" && <ResetPasswordDialog u={u} onClose={() => setDlg(null)} />}
      <ConfirmDialog open={dlg === "deactivate"} onClose={() => setDlg(null)} onConfirm={() => act.mutate("deactivate")} loading={act.isPending} danger confirmLabel="Deactivate" title={`Deactivate ${fullName(u)}?`}>
        <p>They are signed out immediately and cannot sign in until the account is activated again.</p>
        <div className="mt-3"><label className="label" htmlFor="why">Reason (optional)</label><Textarea id="why" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </ConfirmDialog>
      <ConfirmDialog open={dlg === "revoke"} onClose={() => setDlg(null)} onConfirm={() => act.mutate("revoke")} loading={act.isPending} danger confirmLabel="End sessions" title="End all sessions?">{fullName(u)} will be signed out on every device.</ConfirmDialog>
      <ConfirmDialog open={dlg === "delete"} onClose={() => setDlg(null)} onConfirm={() => act.mutate("delete")} loading={act.isPending} danger confirmLabel="Delete user" title={`Delete ${fullName(u)}?`}>
        The account is removed and cannot sign in. Their past requests and activity stay on record.
      </ConfirmDialog>
    </>
  );
}
export default function UserPage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <RequirePermission any={P.usersView}><Detail id={id} /></RequirePermission>; }
