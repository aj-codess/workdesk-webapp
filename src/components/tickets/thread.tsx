"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import { del, get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { P } from "@/lib/permissions";
import type { Comment, TicketDetail } from "@/lib/types";
import { fmtAgo, fmtDateTime, fullName } from "@/lib/format";
import { Avatar, Badge, Button, EmptyState, ErrorState, errorText, Skeleton, Textarea } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function Thread({ ticket }: { ticket: TicketDetail }) {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["ticket", ticket.id, "comments"];
  const q = useQuery({ queryKey: key, queryFn: async () => (await get<Comment[]>(`/api/tickets/${ticket.id}/comments`, { limit: 100 })).data });
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [removing, setRemoving] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canComment = ticket.allowedActions.includes("comment");
  const canNote = ticket.allowedActions.includes("add_work_note");
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["ticket", ticket.id, "activity"] }); };

  const add = useMutation({
    mutationFn: () => post(`/api/tickets/${ticket.id}/comments`, { body: body.trim(), kind: internal ? "WORK_NOTE" : "COMMENT" }),
    onSuccess: () => { setBody(""); setError(null); refresh(); },
    onError: (e) => setError(errorText(e)),
  });
  const save = useMutation({
    mutationFn: (id: string) => patch(`/api/tickets/${ticket.id}/comments/${id}`, { body: editBody.trim() }),
    onSuccess: () => { setEditing(null); refresh(); toast.success("Comment updated"); },
    onError: (e) => toast.error(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/tickets/${ticket.id}/comments/${id}`),
    onSuccess: () => { setRemoving(null); refresh(); toast.success("Comment deleted"); },
    onError: (e) => { setRemoving(null); toast.error(errorText(e)); },
  });

  return (
    <div>
      {q.isLoading ? <div className="space-y-4 p-4">{[0, 1].map((i) => <div key={i} className="flex gap-3"><Skeleton className="h-7 w-7 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="w-40" /><Skeleton className="w-full" /></div></div>)}</div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data!.length === 0 ? <EmptyState title="No messages yet" text="Comments, questions and answers about this request appear here." />
        : (
          <ul className="divide-y divide-line">
            {q.data!.map((c) => {
              const mine = c.author.id === user?.id;
              return (
                <li key={c.id} className={clsx("flex gap-3 px-4 py-3.5", c.kind === "WORK_NOTE" && "bg-warn-bg/50", c.kind === "CLARIFICATION" && "bg-info-bg/60")}>
                  <Avatar user={c.author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold">{fullName(c.author)}</span>
                      {c.kind === "WORK_NOTE" && <Badge tone="warn"><Lock className="h-3 w-3" />Internal note</Badge>}
                      {c.kind === "CLARIFICATION" && <Badge tone="info">Clarification</Badge>}
                      <span className="text-xs text-ink-3" title={fmtDateTime(c.createdAt)}>{fmtAgo(c.createdAt)}{c.editedAt && " (edited)"}</span>
                      <span className="ml-auto flex gap-1">
                        {mine && c.kind !== "CLARIFICATION" && <button className="rounded p-1 text-ink-4 hover:bg-white hover:text-ink" onClick={() => { setEditing(c.id); setEditBody(c.body); }} aria-label="Edit comment"><Pencil className="h-3.5 w-3.5" /></button>}
                        {(mine || can(P.tDelete)) && <button className="rounded p-1 text-ink-4 hover:bg-white hover:text-bad-fg" onClick={() => setRemoving(c)} aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </span>
                    </div>
                    {editing === c.id ? (
                      <div className="mt-2">
                        <Textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                        <div className="mt-2 flex gap-2"><Button size="sm" variant="primary" loading={save.isPending} disabled={!editBody.trim()} onClick={() => save.mutate(c.id)}>Save</Button><Button size="sm" onClick={() => setEditing(null)}>Cancel</Button></div>
                      </div>
                    ) : <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-2">{c.body}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      {canComment ? (
        <form className="border-t border-line bg-[#F8F9FB] p-4" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}>
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder={internal ? "Write an internal note. The requester cannot see it." : "Write a reply"} aria-label="New message" />
          {error && <p className="field-error">{error}</p>}
          <div className="mt-2 flex items-center justify-between">
            {canNote ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2"><input type="checkbox" className="check" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal note (staff only)</label>
            ) : <span />}
            <Button type="submit" variant="primary" loading={add.isPending} disabled={!body.trim()}>{internal ? "Add note" : "Post reply"}</Button>
          </div>
        </form>
      ) : <p className="border-t border-line bg-[#F8F9FB] px-4 py-3 text-sm text-ink-3">Comments are closed for this request.</p>}

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing.id)} loading={remove.isPending} danger confirmLabel="Delete" title="Delete this comment?">
        This removes the comment from the conversation.
      </ConfirmDialog>
    </div>
  );
}
