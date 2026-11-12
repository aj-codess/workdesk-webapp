"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, get, patch, post } from "@/lib/api";
import { PRIORITIES, type LookupAgent, type LookupCategory, type LookupDept, type TicketAction, type TicketDetail } from "@/lib/types";
import { PRIORITY_LABEL } from "@/lib/format";
import { Alert, Button, errorText, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";

type FieldKind = "text" | "textarea" | "priority" | "agent" | "dept" | "category";
interface FieldDef { name: string; label: string; kind: FieldKind; required?: boolean; min?: number; max?: number; hint?: string; rows?: number }
interface ActionDef {
  title: string; description?: string; confirm: string; danger?: boolean; width?: "sm" | "md" | "lg";
  fields: FieldDef[];
  /** returns [method, path, body] */
  request: (t: TicketDetail, v: Record<string, string>) => ["post" | "patch", string, unknown];
}

export type DialogAction = Exclude<TicketAction, "comment" | "add_work_note" | "delete">;

const ACTIONS: Record<DialogAction, ActionDef> = {
  edit: {
    title: "Edit request", confirm: "Save changes", width: "lg",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, min: 3, max: 200 },
      { name: "categoryId", label: "Category", kind: "category", required: true },
      { name: "description", label: "Description", kind: "textarea", required: true, min: 10, max: 10000, rows: 8 },
    ],
    request: (t, v) => ["patch", `/api/tickets/${t.id}`, { title: v.title, categoryId: v.categoryId, description: v.description }],
  },
  change_priority: {
    title: "Change priority", confirm: "Update priority",
    fields: [{ name: "priority", label: "Priority", kind: "priority", required: true }, { name: "reason", label: "Reason", kind: "textarea", max: 500, rows: 3 }],
    request: (t, v) => ["patch", `/api/tickets/${t.id}/priority`, { priority: v.priority, reason: v.reason || undefined }],
  },
  accept: {
    title: "Accept request", description: "The department agrees to handle this request. It can then be assigned to an agent.", confirm: "Accept",
    fields: [{ name: "note", label: "Note (optional)", kind: "textarea", max: 1000, rows: 3 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/accept`, { note: v.note || undefined }],
  },
  reject: {
    title: "Reject request", description: "The requester will see the reason. This cannot be undone.", confirm: "Reject request", danger: true,
    fields: [{ name: "reason", label: "Reason", kind: "textarea", required: true, min: 5, max: 1000, rows: 4 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/reject`, { reason: v.reason }],
  },
  request_clarification: {
    title: "Ask for clarification", description: "The request goes back to the requester until they answer.", confirm: "Send question",
    fields: [{ name: "question", label: "Your question", kind: "textarea", required: true, min: 5, max: 2000, rows: 4 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/request-clarification`, { question: v.question }],
  },
  provide_clarification: {
    title: "Answer the question", description: "Your answer returns the request to review.", confirm: "Send answer",
    fields: [{ name: "response", label: "Your answer", kind: "textarea", required: true, min: 5, max: 5000, rows: 5 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/provide-clarification`, { response: v.response }],
  },
  assign: {
    title: "Assign to an agent", confirm: "Assign",
    fields: [{ name: "agentId", label: "Agent", kind: "agent", required: true }, { name: "note", label: "Note for the agent (optional)", kind: "textarea", max: 1000, rows: 3 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/assign`, { agentId: v.agentId, note: v.note || undefined }],
  },
  reassign: {
    title: "Reassign to another agent", confirm: "Reassign",
    fields: [{ name: "agentId", label: "New agent", kind: "agent", required: true }, { name: "reason", label: "Reason for reassigning", kind: "textarea", required: true, min: 5, max: 500, rows: 3 }, { name: "note", label: "Note (optional)", kind: "textarea", max: 1000, rows: 2 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/assign`, { agentId: v.agentId, reason: v.reason, note: v.note || undefined }],
  },
  start: {
    title: "Start work", description: "Mark the request as in progress.", confirm: "Start work",
    fields: [{ name: "note", label: "Note (optional)", kind: "textarea", max: 1000, rows: 3 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/status`, { status: "IN_PROGRESS", note: v.note || undefined }],
  },
  resolve: {
    title: "Resolve request", description: "Describe what was done. The requester will see this.", confirm: "Mark resolved", width: "lg",
    fields: [{ name: "resolution", label: "Resolution", kind: "textarea", required: true, min: 10, max: 5000, rows: 6 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/resolve`, { resolution: v.resolution }],
  },
  close: {
    title: "Close request", description: "Closing confirms the work is complete.", confirm: "Close request",
    fields: [{ name: "note", label: "Note (optional)", kind: "textarea", max: 1000, rows: 3 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/close`, { note: v.note || undefined }],
  },
  reopen: {
    title: "Reopen request", description: "Use this if the problem is not fixed.", confirm: "Reopen",
    fields: [{ name: "reason", label: "Why is it being reopened?", kind: "textarea", required: true, min: 5, max: 1000, rows: 4 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/reopen`, { reason: v.reason }],
  },
  cancel: {
    title: "Cancel request", description: "A cancelled request cannot be reopened.", confirm: "Cancel request", danger: true,
    fields: [{ name: "reason", label: "Reason (optional)", kind: "textarea", max: 500, rows: 3 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/cancel`, { reason: v.reason || undefined }],
  },
  transfer: {
    title: "Transfer to another department", description: "The request goes back to review in the new department and loses its current assignee.", confirm: "Transfer",
    fields: [{ name: "departmentId", label: "Department", kind: "dept", required: true }, { name: "categoryId", label: "Category", kind: "category", required: true }, { name: "reason", label: "Reason", kind: "textarea", required: true, min: 5, max: 500, rows: 3 }],
    request: (t, v) => ["post", `/api/tickets/${t.id}/transfer`, { departmentId: v.departmentId, categoryId: v.categoryId, reason: v.reason }],
  },
};

export const ACTION_LABEL: Record<TicketAction, string> = {
  edit: "Edit request", change_priority: "Change priority", accept: "Accept", reject: "Reject", request_clarification: "Ask for clarification",
  provide_clarification: "Answer question", assign: "Assign to agent", reassign: "Reassign", start: "Start work", resolve: "Resolve", close: "Close",
  reopen: "Reopen", cancel: "Cancel request", transfer: "Transfer department", comment: "Comment", add_work_note: "Work note", delete: "Delete",
};

export function ActionDialog({ action, ticket, onClose, onDone }: { action: DialogAction | null; ticket: TicketDetail; onClose: () => void; onDone: (a: DialogAction, result: unknown) => void }) {
  const def = action ? ACTIONS[action] : null;
  const initial = useMemo<Record<string, string>>(() => ({
    title: ticket.title, description: ticket.description, priority: ticket.priority, categoryId: action === "edit" ? ticket.category.id : "", departmentId: "", agentId: "",
  }), [ticket, action]);
  const [v, setV] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setV(initial); setErrors({}); setFormError(null); }, [action, initial]);

  const needsAgent = !!def?.fields.some((f) => f.kind === "agent");
  const needsDept = !!def?.fields.some((f) => f.kind === "dept");
  const catDept = action === "transfer" ? v.departmentId : ticket.department.id;
  const agents = useQuery({ queryKey: ["lookup", "agents", ticket.department.id], enabled: !!action && needsAgent, queryFn: async () => (await get<LookupAgent[]>("/api/lookups/agents", { departmentId: ticket.department.id })).data });
  const depts = useQuery({ queryKey: ["lookup", "departments"], enabled: !!action && needsDept, staleTime: 120_000, queryFn: async () => (await get<LookupDept[]>("/api/lookups/departments")).data });
  const cats = useQuery({ queryKey: ["lookup", "categories", catDept], enabled: !!action && !!def?.fields.some((f) => f.kind === "category") && !!catDept, queryFn: async () => (await get<LookupCategory[]>("/api/lookups/categories", { departmentId: catDept })).data });

  if (!def || !action) return null;
  const set = (name: string, value: string) => { setV((s) => ({ ...s, [name]: value, ...(name === "departmentId" ? { categoryId: "" } : {}) })); setErrors((e) => ({ ...e, [name]: "" })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of def.fields) {
      const val = (v[f.name] ?? "").trim();
      if (f.required && !val) errs[f.name] = `${f.label.replace(/ \(optional\)/, "")} is required`;
      else if (val && f.min && val.length < f.min) errs[f.name] = `Enter at least ${f.min} characters`;
      else if (val && f.max && val.length > f.max) errs[f.name] = `Keep it under ${f.max} characters`;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFormError(null);
    try {
      const [method, path, body] = def.request(ticket, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()])));
      const r = method === "patch" ? await patch(path, body) : await post(path, body);
      onDone(action, r.data);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else setFormError(errorText(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title={def.title} description={def.description} width={def.width ?? "md"}
      footer={<><Button onClick={onClose} disabled={busy}>Close</Button><Button type="submit" form="action-form" variant={def.danger ? "danger" : "primary"} loading={busy}>{def.confirm}</Button></>}>
      <form id="action-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert tone="bad">{formError}</Alert>}
        {def.fields.map((f) => {
          const common = { id: `f-${f.name}`, invalid: !!errors[f.name] };
          return (
            <Field key={f.name} label={f.label} required={f.required && !/optional/.test(f.label)} error={errors[f.name]} hint={f.hint} htmlFor={common.id}>
              {f.kind === "text" && <Input {...common} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} maxLength={f.max} />}
              {f.kind === "textarea" && <Textarea {...common} rows={f.rows ?? 4} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />}
              {f.kind === "priority" && <Select {...common} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select>}
              {f.kind === "agent" && (
                <Select {...common} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} disabled={agents.isLoading}>
                  <option value="">{agents.isLoading ? "Loading agents" : agents.data?.length ? "Select an agent" : "No eligible agents"}</option>
                  {agents.data?.filter((a) => a.id !== ticket.assignedAgent?.id).map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName} ({a.openTickets} open)</option>)}
                </Select>
              )}
              {f.kind === "dept" && (
                <Select {...common} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">Select department</option>
                  {depts.data?.filter((d) => d.id !== ticket.department.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              )}
              {f.kind === "category" && (
                <Select {...common} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} disabled={!catDept || cats.isLoading}>
                  <option value="">{!catDept ? "Choose a department first" : "Select category"}</option>
                  {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </Field>
          );
        })}
        {needsAgent && agents.data && agents.data.length === 0 && <Alert tone="warn">No active agent in this department can take requests. Add members to the department first.</Alert>}
      </form>
    </Modal>
  );
}
