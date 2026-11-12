"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { del, get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { TICKET_STAFF_VIEW, TICKET_VIEW } from "@/lib/permissions";
import type { TicketAction, TicketDetail } from "@/lib/types";
import { fmtDateTime, fullName } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Alert, Button, Card, ErrorState, errorText, Skeleton, Tabs } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/modal";
import { RequirePermission } from "@/components/permission";
import { ACTION_LABEL, ActionDialog, type DialogAction } from "@/components/tickets/action-dialog";
import { Thread } from "@/components/tickets/thread";
import { ActivityList, AssignmentList } from "@/components/tickets/history";
import { Attachments } from "@/components/tickets/attachments";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import Link from "next/link";

// Order and emphasis of the buttons in the action panel. Only actions the API says are allowed are shown.
const PRIMARY: TicketAction[] = ["provide_clarification", "accept", "assign", "reassign", "start", "resolve", "close", "reopen"];
const SECONDARY: TicketAction[] = ["request_clarification", "edit", "change_priority", "transfer"];
const DANGER: TicketAction[] = ["reject", "cancel"];

function Detail({ id }: { id: string }) {
  const { can } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"conversation" | "activity" | "assignments" | "files">("conversation");
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const q = useQuery({ queryKey: ["ticket", id], queryFn: async () => (await get<TicketDetail>(`/api/tickets/${id}`)).data, retry: false });
  const t = q.data;

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["ticket", id] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["dash"] });
  };
  const remove = useMutation({
    mutationFn: () => del(`/api/tickets/${id}`),
    onSuccess: () => { toast.success("Request deleted"); qc.invalidateQueries({ queryKey: ["tickets"] }); router.replace("/tickets"); },
    onError: (e) => { setConfirmDelete(false); toast.error(errorText(e)); },
  });

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-7 w-96" /><Skeleton className="h-40 w-full" /></div>;
  if (q.isError || !t) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return <Card>{notFound ? <div className="py-10 text-center"><p className="text-sm font-semibold">Request not found</p><p className="mt-1 text-sm text-ink-3">It does not exist, or you cannot see it.</p><Link href="/tickets" className="mt-3 inline-block text-sm">Back to requests</Link></div> : <ErrorState error={q.error} onRetry={() => q.refetch()} />}</Card>;
  }

  const has = (a: TicketAction) => t.allowedActions.includes(a);
  const run = (a: TicketAction) => setDialog(a as DialogAction);
  const isStaff = can(...TICKET_STAFF_VIEW);
  const primary = PRIMARY.filter(has), secondary = SECONDARY.filter(has), danger = DANGER.filter(has);
  const noActions = !primary.length && !secondary.length && !danger.length && !has("delete");

  const onDone = (a: DialogAction, result: unknown) => {
    setDialog(null);
    if (a === "transfer") {
      // The caller may no longer be able to see the ticket after moving it, and the API answers with a slim record.
      toast.success("Request transferred");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dash"] });
      router.replace("/tickets");
      return;
    }
    if (result && typeof result === "object" && "allowedActions" in result) qc.setQueryData(["ticket", id], result);
    toast.success(`${ACTION_LABEL[a]}: done`);
    refreshAll();
    qc.invalidateQueries({ queryKey: ["ticket", id, "comments"] });
    qc.invalidateQueries({ queryKey: ["ticket", id, "activity"] });
    qc.invalidateQueries({ queryKey: ["ticket", id, "assignments"] });
  };

  return (
    <>
      <div className="mb-5">
        <Link href="/tickets" className="mb-2 inline-block text-xs text-ink-3 no-underline hover:text-brand-600">&larr; Requests</Link>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="font-mono text-xs text-ink-3">{t.reference}</p>
            <h1 className="mt-0.5 text-2xl">{t.title}</h1>
            <div className="mt-2 flex items-center gap-2"><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} />{t.reopenCount > 0 && <span className="text-xs text-ink-3">Reopened {t.reopenCount} time{t.reopenCount > 1 ? "s" : ""}</span>}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
        <div className="space-y-5">
          {t.status === "REJECTED" && t.rejectionReason && <Alert tone="bad" title="This request was rejected">{t.rejectionReason}</Alert>}
          {t.status === "CLARIFICATION_REQUESTED" && <Alert tone="warn" title="Waiting for the requester">The department asked a question. Review starts again once it is answered.</Alert>}
          <Card title="Description"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-2">{t.description}</p></Card>
          {t.resolution && (
            <Card title={<span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-ok-fg" />Resolution</span>}>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-2">{t.resolution}</p>
              <p className="mt-3 text-xs text-ink-3">{t.resolvedBy ? `Resolved by ${fullName(t.resolvedBy)}` : "Resolved"} on {fmtDateTime(t.resolvedAt)}</p>
            </Card>
          )}
          <div>
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: "conversation", label: "Conversation" }, { id: "activity", label: "Activity" },
              { id: "assignments", label: "Assignments", hidden: !isStaff }, { id: "files", label: "Attachments" },
            ]} />
            <Card className="rounded-t-none border-t-0" flush>
              {tab === "conversation" && <Thread ticket={t} />}
              {tab === "activity" && <ActivityList ticketId={id} />}
              {tab === "assignments" && isStaff && <AssignmentList ticketId={id} />}
              {tab === "files" && <Attachments ticket={t} />}
            </Card>
          </div>
        </div>

        <aside className="space-y-5">
          <Card title="Actions">
            {noActions ? <p className="text-sm text-ink-3">There is nothing you can do on this request right now.</p> : (
              <div className="space-y-2">
                {primary.map((a, i) => <Button key={a} variant={i === 0 ? "primary" : "secondary"} className="w-full" onClick={() => run(a)}>{ACTION_LABEL[a]}</Button>)}
                {secondary.map((a) => <Button key={a} className="w-full" onClick={() => run(a)}>{ACTION_LABEL[a]}</Button>)}
                {(danger.length > 0 || has("delete")) && (
                  <div className="space-y-2 border-t border-line pt-2">
                    {danger.map((a) => <Button key={a} variant="danger-outline" className="w-full" onClick={() => run(a)}><XCircle className="h-3.5 w-3.5" />{ACTION_LABEL[a]}</Button>)}
                    {has("delete") && <Button variant="danger-outline" className="w-full" onClick={() => setConfirmDelete(true)}>Delete request</Button>}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Details">
            <dl className="kv">
              <dt>Requester</dt><dd>{fullName(t.requester)}{t.requester.email && <span className="block text-xs text-ink-3">{t.requester.email}</span>}{t.requester.department && <span className="block text-xs text-ink-3">{t.requester.department.name}</span>}</dd>
              <dt>Department</dt><dd>{t.department.name}</dd>
              <dt>Category</dt><dd>{t.category.name}</dd>
              <dt>Assigned to</dt><dd>{t.assignedAgent ? fullName(t.assignedAgent) : <span className="text-ink-4">Not assigned</span>}</dd>
              {t.reviewedBy && <><dt>Reviewed by</dt><dd>{fullName(t.reviewedBy)}<span className="block text-xs text-ink-3">{fmtDateTime(t.reviewedAt)}</span></dd></>}
              <dt>Submitted</dt><dd>{fmtDateTime(t.createdAt)}</dd>
              <dt>Last updated</dt><dd className="!mb-0">{fmtDateTime(t.updatedAt)}</dd>
            </dl>
          </Card>
        </aside>
      </div>

      <ActionDialog action={dialog} ticket={t} onClose={() => setDialog(null)} onDone={onDone} />
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger confirmLabel="Delete request" title="Delete this request?">
        {t.reference} will be removed for everyone. The deletion is recorded in the audit log.
      </ConfirmDialog>
    </>
  );
}

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequirePermission any={TICKET_VIEW}><Detail id={id} /></RequirePermission>;
}
