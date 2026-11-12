import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import type { Priority, TicketStatus } from "./types";

const d = (iso: string | null | undefined) => { if (!iso) return null; const x = parseISO(iso); return isValid(x) ? x : null; };

export const fmtDate = (iso?: string | null) => { const x = d(iso); return x ? format(x, "d MMM yyyy") : "-"; };
export const fmtDateTime = (iso?: string | null) => { const x = d(iso); return x ? format(x, "d MMM yyyy, HH:mm") : "-"; };
export const fmtAgo = (iso?: string | null) => { const x = d(iso); return x ? `${formatDistanceToNowStrict(x)} ago` : "-"; };
export const fullName = (u?: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}`.trim() : "-");
export const initials = (u?: { firstName: string; lastName: string } | null) => (u ? `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase() : "?");
export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const fmtHours = (h: number | null | undefined) => {
  if (h === null || h === undefined) return "-";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
};
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export const STATUS_LABEL: Record<TicketStatus, string> = {
  PENDING_REVIEW: "Pending review", CLARIFICATION_REQUESTED: "Needs clarification", ACCEPTED: "Accepted", REJECTED: "Rejected",
  ASSIGNED: "Assigned", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};
export const PRIORITY_LABEL: Record<Priority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };

export const ACTIVITY_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted the request", UPDATED: "Edited the request", CLARIFICATION_REQUESTED: "Asked for clarification",
  CLARIFICATION_PROVIDED: "Provided clarification", ACCEPTED: "Accepted the request", REJECTED: "Rejected the request",
  ASSIGNED: "Assigned the request", REASSIGNED: "Reassigned the request", STATUS_CHANGED: "Changed the status",
  PRIORITY_CHANGED: "Changed the priority", DEPARTMENT_TRANSFERRED: "Transferred to another department",
  COMMENTED: "Added a comment", RESOLVED: "Resolved the request", CLOSED: "Closed the request",
  REOPENED: "Reopened the request", CANCELLED: "Cancelled the request", DELETED: "Deleted the request",
};

export function humanize(s: string) {
  const t = s.replace(/[._]/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
