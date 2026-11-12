import { Badge, type Tone } from "@/components/ui";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Priority, TicketStatus } from "@/lib/types";

const STATUS_TONE: Record<TicketStatus, Tone> = {
  PENDING_REVIEW: "warn", CLARIFICATION_REQUESTED: "warn", ACCEPTED: "info", REJECTED: "bad", ASSIGNED: "info",
  IN_PROGRESS: "teal", RESOLVED: "ok", CLOSED: "mute", REOPENED: "warn", CANCELLED: "mute",
};
export const StatusBadge = ({ status }: { status: TicketStatus }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;

const PRIORITY_TONE: Record<Priority, Tone> = { LOW: "mute", MEDIUM: "info", HIGH: "warn", CRITICAL: "bad" };
export const PriorityBadge = ({ priority }: { priority: Priority }) => <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;

export const ActiveBadge = ({ active, on = "Active", off = "Inactive" }: { active: boolean; on?: string; off?: string }) => <Badge tone={active ? "ok" : "mute"}>{active ? on : off}</Badge>;
