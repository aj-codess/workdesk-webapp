"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, put } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { P } from "@/lib/permissions";
import type { Setting } from "@/lib/types";
import { fmtDateTime, fullName } from "@/lib/format";
import { Button, Card, ErrorState, errorText, Input, PageHeader, TableSkeleton } from "@/components/ui";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";

// Display names and ranges; the server validates every value again.
const META: Record<string, { label: string; kind: "int" | "mime"; min?: number; max?: number; unit?: string }> = {
  "department.max_managers": { label: "Managers per department", kind: "int", min: 1, max: 10 },
  "auth.max_failed_logins": { label: "Failed sign-ins before lockout", kind: "int", min: 3, max: 10 },
  "auth.lockout_minutes": { label: "Lockout duration", kind: "int", min: 1, max: 1440, unit: "minutes" },
  "attachments.max_size_mb": { label: "Largest attachment", kind: "int", min: 1, max: 25, unit: "MB" },
  "attachments.allowed_mime_types": { label: "Allowed attachment types", kind: "mime" },
};
const MIME: [string, string][] = [["image/png", "PNG image"], ["image/jpeg", "JPEG image"], ["application/pdf", "PDF"], ["text/plain", "Plain text"]];

function Row({ s, canEdit }: { s: Setting; canEdit: boolean }) {
  const qc = useQueryClient(); const toast = useToast();
  const meta = META[s.key];
  const [val, setVal] = useState<unknown>(s.value);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(val) !== JSON.stringify(s.value);
  const m = useMutation({
    mutationFn: () => put(`/api/settings/${s.key}`, { value: val }),
    onSuccess: () => { toast.success("Setting saved"); setError(null); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => setError(errorText(e)),
  });
  const bad = meta?.kind === "int" && (!Number.isInteger(val) || (meta.min !== undefined && (val as number) < meta.min) || (meta.max !== undefined && (val as number) > meta.max));
  return (
    <div className="grid grid-cols-[1fr_340px] items-start gap-8 px-4 py-4">
      <div><p className="text-sm font-medium">{meta?.label ?? s.key}</p><p className="font-mono text-xs text-ink-3">{s.key}</p>
        {s.description && <p className="mt-1 text-xs text-ink-3">{s.description}</p>}
        <p className="mt-1 text-xs text-ink-4">Updated {fmtDateTime(s.updatedAt)}{s.updatedBy ? ` by ${fullName(s.updatedBy)}` : ""}</p></div>
      <div>
        {meta?.kind === "mime" ? (
          <div className="space-y-1.5">{MIME.map(([m1, l]) => {
            const list = Array.isArray(val) ? (val as string[]) : [];
            return <label key={m1} className="flex items-center gap-2 text-sm"><input type="checkbox" className="check" disabled={!canEdit} checked={list.includes(m1)} onChange={(e) => setVal(e.target.checked ? [...list, m1] : list.filter((x) => x !== m1))} />{l}</label>;
          })}</div>
        ) : meta?.kind === "int" ? (
          <div className="flex items-center gap-2"><Input type="number" className="!w-28" min={meta.min} max={meta.max} disabled={!canEdit} value={typeof val === "number" ? val : ""} onChange={(e) => setVal(e.target.value === "" ? "" : Number(e.target.value))} invalid={!!bad} />
            {meta.unit && <span className="text-sm text-ink-3">{meta.unit}</span>}<span className="text-xs text-ink-4">{meta.min} to {meta.max}</span></div>
        ) : <code className="text-xs">{JSON.stringify(s.value)}</code>}
        {error && <p className="field-error">{error}</p>}
        {canEdit && meta && dirty && <div className="mt-3 flex gap-2"><Button size="sm" variant="primary" loading={m.isPending} disabled={!!bad || (Array.isArray(val) && val.length === 0)} onClick={() => m.mutate()}>Save</Button><Button size="sm" onClick={() => { setVal(s.value); setError(null); }}>Reset</Button></div>}
      </div>
    </div>
  );
}

function Settings() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ["settings"], queryFn: async () => (await get<Setting[]>("/api/settings")).data });
  return (
    <>
      <PageHeader title="Settings" subtitle="System-wide rules. Changes apply immediately and are recorded in the audit log." />
      <Card flush>
        {q.isLoading ? <TableSkeleton rows={5} cols={2} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <div className="divide-y divide-line">{q.data!.map((s) => <Row key={`${s.key}:${s.updatedAt}`} s={s} canEdit={can(P.settingsUpdate)} />)}</div>
        )}
      </Card>
    </>
  );
}
export default function SettingsPage() { return <RequirePermission any={P.settingsView}><Settings /></RequirePermission>; }
