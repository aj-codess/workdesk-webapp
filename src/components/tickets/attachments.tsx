"use client";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { del, download, get, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { P } from "@/lib/permissions";
import type { Attachment, TicketDetail } from "@/lib/types";
import { fmtBytes, fmtDateTime, fullName } from "@/lib/format";
import { Button, EmptyState, ErrorState, errorText, TableSkeleton } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function Attachments({ ticket }: { ticket: TicketDetail }) {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["ticket", ticket.id, "attachments"];
  const q = useQuery({ queryKey: key, queryFn: async () => (await get<Attachment[]>(`/api/tickets/${ticket.id}/attachments`)).data });
  const ref = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const canUpload = ticket.allowedActions.includes("comment") || ticket.requester.id === user?.id;

  const up = useMutation({
    mutationFn: async (f: File) => { const fd = new FormData(); fd.append("file", f); return uploadFile(`/api/tickets/${ticket.id}/attachments`, fd); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("File uploaded"); },
    onError: (e) => toast.error(errorText(e)),
  });
  const rm = useMutation({
    mutationFn: (id: string) => del(`/api/tickets/${ticket.id}/attachments/${id}`),
    onSuccess: () => { setRemoving(null); qc.invalidateQueries({ queryKey: key }); toast.success("Attachment removed"); },
    onError: (e) => { setRemoving(null); toast.error(errorText(e)); },
  });

  return (
    <div>
      {canUpload && (
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-xs text-ink-3">PNG, JPEG, PDF or plain text, up to 5 MB.</p>
          <input ref={ref} type="file" hidden accept=".png,.jpg,.jpeg,.pdf,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = ""; }} />
          <Button size="sm" loading={up.isPending} onClick={() => ref.current?.click()}><Paperclip className="h-3.5 w-3.5" />Upload file</Button>
        </div>
      )}
      {q.isLoading ? <TableSkeleton rows={2} cols={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
        !q.data!.length ? <EmptyState title="No attachments" /> : (
          <ul className="divide-y divide-line">
            {q.data!.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                {a.mimeType.startsWith("image/") ? <ImageIcon className="h-4 w-4 text-ink-3" /> : <FileText className="h-4 w-4 text-ink-3" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.fileName}</p>
                  <p className="text-xs text-ink-3">{fmtBytes(a.sizeBytes)} · {fullName(a.uploadedBy)} · {fmtDateTime(a.createdAt)}</p>
                </div>
                <Button size="sm" onClick={() => download(`/api/tickets/${ticket.id}/attachments/${a.id}/download`, undefined, a.fileName).catch((e) => toast.error(errorText(e)))}><Download className="h-3.5 w-3.5" />Download</Button>
                {(a.uploadedBy.id === user?.id || can(P.tDelete)) && <Button size="sm" variant="ghost" icon onClick={() => setRemoving(a)} aria-label={`Delete ${a.fileName}`}><Trash2 className="h-4 w-4" /></Button>}
              </li>
            ))}
          </ul>
        )}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && rm.mutate(removing.id)} loading={rm.isPending} danger confirmLabel="Delete" title="Delete this file?">
        {removing?.fileName} will be permanently removed from the request.
      </ConfirmDialog>
    </div>
  );
}
