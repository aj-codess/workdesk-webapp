"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError, del, get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PASSWORD_HELP, PASSWORD_RULE, applyServerErrors } from "@/lib/forms";
import type { AuthUser, SessionRow } from "@/lib/types";
import { fullName } from "@/lib/format";
import { Alert, Avatar, Badge, Button, Card, ErrorState, errorText, Field, Input, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/modal";
import { SessionList } from "@/components/session-list";
import { useToast } from "@/components/ui/toast";

const profileSchema = z.object({ firstName: z.string().trim().min(1, "Required").max(100), lastName: z.string().trim().min(1, "Required").max(100), phone: z.string().max(30).optional(), jobTitle: z.string().max(120).optional() });

function ProfileForm() {
  const { user, setUser } = useAuth(); const toast = useToast(); const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { firstName: user!.firstName, lastName: user!.lastName, phone: user!.phone ?? "", jobTitle: user!.jobTitle ?? "" } });
  const m = useMutation({
    mutationFn: (v: z.infer<typeof profileSchema>) => patch<AuthUser>("/api/profile", { firstName: v.firstName, lastName: v.lastName, phone: v.phone || null, jobTitle: v.jobTitle || null }),
    onSuccess: (r) => { setUser(r.data); toast.success("Profile updated"); form.reset(form.getValues()); },
    onError: (e) => { if (!applyServerErrors(form, e)) setError(errorText(e)); },
  });
  const err = form.formState.errors;
  return (
    <div className="grid grid-cols-[1fr_300px] items-start gap-6">
      <Card title="Your details">
        <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => { setError(null); m.mutate(v); })}>
          {error && <Alert tone="bad">{error}</Alert>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required error={err.firstName?.message}><Input invalid={!!err.firstName} {...form.register("firstName")} /></Field>
            <Field label="Last name" required error={err.lastName?.message}><Input invalid={!!err.lastName} {...form.register("lastName")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4"><Field label="Phone"><Input {...form.register("phone")} /></Field><Field label="Job title"><Input {...form.register("jobTitle")} /></Field></div>
          <div className="flex justify-end border-t border-line pt-4"><Button type="submit" variant="primary" loading={m.isPending} disabled={!form.formState.isDirty}>Save changes</Button></div>
        </form>
      </Card>
      <Card title="Account">
        <dl className="kv"><dt>Email</dt><dd className="break-all">{user!.email}</dd><dt>Department</dt><dd>{user!.department?.name ?? "-"}</dd>
          <dt>Roles</dt><dd className="!mb-0 flex flex-wrap gap-1.5">{user!.roles.length ? user!.roles.map((r) => <Badge key={r.id} tone="info">{r.name}</Badge>) : "-"}</dd></dl>
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">Email, department and roles are managed by an administrator.</p>
      </Card>
    </div>
  );
}

const pwSchema = z.object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: z.string().regex(PASSWORD_RULE, PASSWORD_HELP), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "The passwords do not match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password you have not used just now" });

function Security({ must }: { must: boolean }) {
  const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const { logout } = useAuth();
  const [error, setError] = useState<string | null>(null); const [revoking, setRevoking] = useState<string | null>(null); const [allOut, setAllOut] = useState(false);
  const form = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: async () => (await get<SessionRow[]>("/api/auth/sessions")).data });
  const change = useMutation({
    mutationFn: (v: z.infer<typeof pwSchema>) => post("/api/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: async () => { toast.success("Password changed. Please sign in again."); await logout(); router.replace("/login?changed=1"); },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "INVALID_CURRENT_PASSWORD") form.setError("currentPassword", { message: "That is not your current password" });
      else if (!applyServerErrors(form, e)) setError(errorText(e));
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/api/auth/sessions/${id}`),
    onMutate: (id) => setRevoking(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); toast.success("Session ended"); },
    onError: (e) => toast.error(errorText(e)), onSettled: () => setRevoking(null),
  });
  const err = form.formState.errors;
  return (
    <div className="grid grid-cols-2 items-start gap-6">
      <Card title="Change password">
        {must && <Alert tone="warn" className="mb-4" title="Choose a new password to continue">Your account requires a password change before you can use WorkDesk.</Alert>}
        <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => { setError(null); change.mutate(v); })}>
          {error && <Alert tone="bad">{error}</Alert>}
          <Field label="Current password" required error={err.currentPassword?.message}><Input type="password" autoComplete="current-password" invalid={!!err.currentPassword} {...form.register("currentPassword")} /></Field>
          <Field label="New password" required hint={PASSWORD_HELP} error={err.newPassword?.message}><Input type="password" autoComplete="new-password" invalid={!!err.newPassword} {...form.register("newPassword")} /></Field>
          <Field label="Confirm new password" required error={err.confirm?.message}><Input type="password" autoComplete="new-password" invalid={!!err.confirm} {...form.register("confirm")} /></Field>
          <div className="flex items-center justify-between border-t border-line pt-4"><p className="text-xs text-ink-3">You will be signed out everywhere.</p><Button type="submit" variant="primary" loading={change.isPending}>Change password</Button></div>
        </form>
      </Card>
      <Card title="Where you are signed in" actions={<Button size="sm" variant="danger-outline" onClick={() => setAllOut(true)}>Sign out everywhere</Button>} flush>
        {sessions.isLoading ? <Skeleton className="m-4 h-12" /> : sessions.isError ? <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} /> : <SessionList rows={sessions.data!} onRevoke={(s) => revoke.mutate(s.id)} busyId={revoking} />}
      </Card>
      <ConfirmDialog open={allOut} onClose={() => setAllOut(false)} onConfirm={async () => { await post("/api/auth/logout-all").catch(() => {}); await logout(); router.replace("/login"); }} confirmLabel="Sign out everywhere" danger title="Sign out of every device?">This ends all of your sessions, including this one.</ConfirmDialog>
    </div>
  );
}

function Profile() {
  const { user } = useAuth(); const sp = useSearchParams(); const router = useRouter();
  const [tab, setTab] = useState<"profile" | "security">(sp.get("tab") === "security" ? "security" : "profile");
  if (!user) return null;
  const must = user.mustChangePassword;
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-3"><Avatar user={user} size={36} />{fullName(user)}</span>} subtitle={user.jobTitle ?? user.email} />
      <Tabs value={tab} onChange={(t) => { setTab(t); router.replace(t === "security" ? "/profile?tab=security" : "/profile"); }} tabs={[{ id: "profile", label: "Profile" }, { id: "security", label: "Password and sessions" }]} />
      <div className="mt-5">{tab === "profile" ? <ProfileForm /> : <Security must={must} />}</div>
    </>
  );
}
export default function ProfilePage() { return <Suspense><Profile /></Suspense>; }
