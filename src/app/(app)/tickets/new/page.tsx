"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Paperclip, X } from "lucide-react";
import { get, post, uploadFile } from "@/lib/api";
import { P } from "@/lib/permissions";
import { PRIORITIES, type LookupCategory, type LookupDept, type TicketDetail } from "@/lib/types";
import { PRIORITY_LABEL, fmtBytes } from "@/lib/format";
import { Alert, Button, Card, errorText, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { RequirePermission } from "@/components/permission";
import { useToast } from "@/components/ui/toast";
import { applyServerErrors } from "@/lib/forms";

const schema = z.object({
  departmentId: z.string().min(1, "Choose the department that should handle this"),
  categoryId: z.string().min(1, "Choose a category"),
  title: z.string().trim().min(3, "Give the request a short title (at least 3 characters)").max(200, "Keep the title under 200 characters"),
  description: z.string().trim().min(10, "Describe the request in at least 10 characters").max(10000),
  priority: z.enum(PRIORITIES),
});
type Values = z.infer<typeof schema>;

function NewTicket() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { departmentId: "", categoryId: "", title: "", description: "", priority: "MEDIUM" } });
  const deptId = form.watch("departmentId");

  const depts = useQuery({ queryKey: ["lookup", "departments"], staleTime: 120_000, queryFn: async () => (await get<LookupDept[]>("/api/lookups/departments")).data });
  const cats = useQuery({ queryKey: ["lookup", "categories", deptId], enabled: !!deptId, queryFn: async () => (await get<LookupCategory[]>("/api/lookups/categories", { departmentId: deptId })).data });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await post<TicketDetail>("/api/tickets", v);
      let failed = 0;
      for (const f of files) {
        const fd = new FormData(); fd.append("file", f);
        try { await uploadFile(`/api/tickets/${r.data.id}/attachments`, fd); } catch { failed++; }
      }
      toast.success(`Request ${r.data.reference} submitted`);
      if (failed) toast.error(`${failed} attachment${failed > 1 ? "s" : ""} could not be uploaded. You can add them on the request page.`);
      router.push(`/tickets/${r.data.id}`);
    } catch (e) {
      if (!applyServerErrors(form, e)) setError(errorText(e));
    }
  });

  const err = form.formState.errors;
  return (
    <>
      <PageHeader title="New request" subtitle="Tell the right department what you need. A manager reviews every request before work starts." back={{ href: "/tickets", label: "Requests" }} />
      <form onSubmit={onSubmit} noValidate className="grid grid-cols-[1fr_300px] items-start gap-6">
        <Card>
          <div className="space-y-4">
            {error && <Alert tone="bad">{error}</Alert>}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Department" required error={err.departmentId?.message} htmlFor="dept" hint="You can send a request to any department.">
                <Select id="dept" invalid={!!err.departmentId} {...form.register("departmentId", { onChange: () => form.setValue("categoryId", "") })}>
                  <option value="">Select department</option>
                  {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Category" required error={err.categoryId?.message} htmlFor="cat">
                <Select id="cat" disabled={!deptId || cats.isLoading} invalid={!!err.categoryId} {...form.register("categoryId")}>
                  <option value="">{!deptId ? "Choose a department first" : cats.isLoading ? "Loading" : cats.data?.length ? "Select category" : "No categories available"}</option>
                  {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isSensitive ? " (sensitive)" : ""}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Title" required error={err.title?.message} htmlFor="title">
              <Input id="title" maxLength={200} placeholder="Short summary of what you need" invalid={!!err.title} {...form.register("title")} />
            </Field>
            <Field label="Description" required error={err.description?.message} htmlFor="desc" hint="Include what happened or what you need, and anything that helps the team act on it.">
              <Textarea id="desc" rows={9} invalid={!!err.description} {...form.register("description")} />
            </Field>
            <Field label="Priority" htmlFor="prio" className="w-56">
              <Select id="prio" {...form.register("priority")}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select>
            </Field>
            <div>
              <span className="label">Attachments</span>
              <input ref={fileRef} type="file" multiple hidden accept=".png,.jpg,.jpeg,.pdf,.txt,image/png,image/jpeg,application/pdf,text/plain"
                onChange={(e) => { setFiles((l) => [...l, ...Array.from(e.target.files ?? [])].slice(0, 10)); e.target.value = ""; }} />
              <Button size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="h-3.5 w-3.5" />Add files</Button>
              <p className="hint">PNG, JPEG, PDF or plain text, up to 5 MB each.</p>
              {files.length > 0 && (
                <ul className="mt-2 divide-y divide-line rounded border border-line">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-1.5 text-sm"><span className="truncate">{f.name} <span className="text-xs text-ink-3">{fmtBytes(f.size)}</span></span>
                      <button type="button" className="text-ink-3 hover:text-bad-fg" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X className="h-4 w-4" /></button></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>Submit request</Button>
          </div>
        </Card>
        <Card title="What happens next">
          <ol className="space-y-3 text-sm text-ink-2">
            <li><span className="font-semibold text-ink">1. Review.</span> A manager of the department accepts, rejects or asks you a question.</li>
            <li><span className="font-semibold text-ink">2. Assignment.</span> Accepted requests are given to an agent.</li>
            <li><span className="font-semibold text-ink">3. Resolution.</span> The agent records what was done. You can reopen the request if it is not fixed.</li>
          </ol>
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">You can edit or cancel the request while it is still waiting for review.</p>
        </Card>
      </form>
    </>
  );
}
export default function NewTicketPage() { return <RequirePermission any={P.tCreate}><NewTicket /></RequirePermission>; }
