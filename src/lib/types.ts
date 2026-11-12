// Response shapes from docs/API_ROUTES.md section 2.

export interface Meta { page: number; limit: number; total: number; totalPages: number }
export interface Paged<T> { data: T[]; meta: Meta }

export interface UserRef { id: string; firstName: string; lastName: string; email: string }
export interface NameRef { id: string; name: string }
export interface DeptRef { id: string; name: string; code: string }

export type UserStatus = "ACTIVE" | "INACTIVE";

export interface UserSummary {
  id: string; email: string; firstName: string; lastName: string; status: UserStatus;
  department: DeptRef | null; roles: NameRef[]; lastLoginAt: string | null; createdAt: string;
}
export interface UserDetail extends UserSummary {
  phone: string | null; jobTitle: string | null; avatarUrl: string | null; mustChangePassword: boolean;
  deactivatedAt: string | null; updatedAt: string; managedDepartments: NameRef[]; memberDepartments: NameRef[];
}
export interface AuthUser {
  id: string; email: string; firstName: string; lastName: string; status: UserStatus;
  department: DeptRef | null; roles: NameRef[]; createdAt: string; updatedAt: string;
  phone: string | null; jobTitle: string | null; avatarUrl: string | null; mustChangePassword: boolean;
  managedDepartmentIds: string[]; memberDepartmentIds: string[];
}
export interface Me { user: AuthUser; permissions: string[] }
export interface LoginResult extends Me { accessToken: string; tokenType: "Bearer"; expiresIn: number }
export interface RefreshResult { accessToken: string; tokenType: "Bearer"; expiresIn: number }

export interface Permission { id: string; key: string; module: string; description: string }
export interface Role {
  id: string; name: string; description: string | null; isActive: boolean; isSystem: boolean;
  permissionCount: number; userCount: number; createdAt: string; updatedAt: string;
}
export interface RoleDetail extends Role { permissions: Permission[] }

export interface Department {
  id: string; name: string; code: string; description: string | null; isActive: boolean;
  managerCount: number; memberCount: number; createdAt: string;
}
export interface DepartmentDetail extends Department { managers: UserRef[] }
export interface Category { id: string; departmentId: string; name: string; description: string | null; isActive: boolean; isSensitive: boolean }
export interface DepartmentMember { user: UserRef; addedAt: string; openTickets: number }

export const TICKET_STATUSES = [
  "PENDING_REVIEW", "CLARIFICATION_REQUESTED", "ACCEPTED", "REJECTED", "ASSIGNED",
  "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface TicketSummary {
  id: string; number: number; reference: string; title: string; status: TicketStatus; priority: Priority;
  category: NameRef; department: DeptRef;
  requester: { id: string; firstName: string; lastName: string };
  assignedAgent: UserRef | null; createdAt: string; updatedAt: string;
}
export type TicketAction =
  | "edit" | "change_priority" | "accept" | "reject" | "request_clarification" | "provide_clarification"
  | "assign" | "reassign" | "start" | "resolve" | "close" | "reopen" | "cancel" | "transfer"
  | "comment" | "add_work_note" | "delete";
export interface TicketDetail extends Omit<TicketSummary, "requester"> {
  description: string;
  requester: {
    id: string; firstName: string; lastName: string;
    email?: string; department?: NameRef | null; roles?: string[];
  };
  reviewedBy: UserRef | null; reviewedAt: string | null; rejectionReason: string | null;
  resolution: string | null; resolvedBy: UserRef | null; resolvedAt: string | null;
  closedAt: string | null; reopenCount: number; allowedActions: TicketAction[];
}
export type CommentKind = "COMMENT" | "WORK_NOTE" | "CLARIFICATION";
export interface Comment {
  id: string; kind: CommentKind; body: string;
  author: { id: string; firstName: string; lastName: string }; createdAt: string; editedAt: string | null;
}
export interface Activity {
  id: string; action: string; fromStatus: TicketStatus | null; toStatus: TicketStatus | null;
  actor: UserRef | null; metadata: Record<string, unknown> | null; createdAt: string;
}
export interface Assignment {
  id: string; agent: UserRef; assignedBy: UserRef; assignedAt: string; unassignedAt: string | null; reason: string | null;
}
export interface Attachment {
  id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedBy: UserRef; commentId: string | null; createdAt: string;
}
export interface SessionRow {
  id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; lastUsedAt: string; expiresAt: string; current: boolean;
}
export interface AuditLog {
  id: string; actor: UserRef | null; action: string; entityType: string | null; entityId: string | null;
  outcome: "SUCCESS" | "DENIED" | "FAILURE"; before: unknown; after: unknown;
  ipAddress: string | null; userAgent: string | null; requestId: string | null; createdAt: string;
}
export interface Setting { key: string; value: unknown; description: string | null; updatedAt: string; updatedBy: UserRef | null }

// dashboards / reports
export interface MyRequestsDash { total: number; open: number; pending: number; inProgress: number; resolved: number; byStatus: Record<string, number>; recentlyUpdated: TicketSummary[] }
export interface MyWorkDash { assigned: number; open: number; inProgress: number; resolvedLast30Days: number; recentlyUpdated: TicketSummary[] }
export interface DeptDash {
  departments: {
    department: NameRef; totalRequests: number; pendingReview: number; clarificationRequested: number;
    unassignedAccepted: number; awaitingResolution: number;
    byAgent: { agent: UserRef; open: number; resolved: number }[];
    avgResolutionHours: number | null; resolvedSampleSize: number;
  }[];
}
export interface SystemDash {
  tickets: { total: number; open: number; resolved: number; byStatus: Record<string, number>; byPriority: Record<string, number> };
  users?: { total: number; active: number; supportAgents: number };
}
export interface ReportSummary {
  period: { from: string; to: string };
  totals: { created: number; resolved: number; closed: number; rejected: number; open: number };
  byStatus: Record<string, number>; byPriority: Record<string, number>;
  avgResolutionHours: number | null; reopenRate: number;
}
export interface ReportGroup { groupBy: string; rows: { key: string; label: string; count: number }[] }
export interface TeamRow { agent: UserRef; assigned: number; resolved: number; open: number; reopened: number; avgResolutionHours: number | null }

export interface LookupDept { id: string; name: string; code: string }
export interface LookupCategory { id: string; name: string; isSensitive: boolean }
export interface LookupAgent { id: string; firstName: string; lastName: string; email: string; openTickets: number }
export interface LookupRole { id: string; name: string; description: string | null; assignable: boolean }
