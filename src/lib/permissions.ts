// One place for permission keys and the route -> permission map. Nothing in the UI compares role names.

export const P = {
  usersView: "users.view", usersCreate: "users.create", usersUpdate: "users.update", usersDelete: "users.delete",
  usersActivate: "users.activate", usersAssignRoles: "users.assign_roles", usersRevokeSessions: "users.revoke_sessions",
  rolesView: "roles.view", rolesCreate: "roles.create", rolesUpdate: "roles.update", rolesDelete: "roles.delete",
  rolesAssignPermissions: "roles.assign_permissions", permissionsView: "permissions.view",
  deptView: "departments.view", deptCreate: "departments.create", deptUpdate: "departments.update", deptMembers: "departments.manage_members",
  catView: "categories.view", catManage: "categories.manage",
  tCreate: "tickets.create", tViewOwn: "tickets.view_own", tViewAssigned: "tickets.view_assigned",
  tViewDept: "tickets.view_department", tViewAll: "tickets.view_all", tUpdateOwn: "tickets.update_own",
  tAssign: "tickets.assign", tAccept: "tickets.accept", tViewWorkNotes: "tickets.view_work_notes",
  tTransfer: "tickets.transfer_department", tComment: "tickets.comment", tDelete: "tickets.delete",
  reportsView: "reports.view", reportsExport: "reports.export", auditView: "audit_logs.view",
  settingsView: "settings.view", settingsUpdate: "settings.update",
} as const;

export const TICKET_VIEW = [P.tViewOwn, P.tViewAssigned, P.tViewDept, P.tViewAll];
export const TICKET_STAFF_VIEW = [P.tViewAssigned, P.tViewDept, P.tViewAll];

export interface NavItem { href: string; label: string; icon: string; any: string[]; group: "Work" | "Insight" | "Administration" }

/** Sidebar entries. An entry is shown when the user holds at least one of `any` (an empty list means always). */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "layout", any: [], group: "Work" },
  { href: "/tickets", label: "Requests", icon: "inbox", any: TICKET_VIEW, group: "Work" },
  { href: "/reports", label: "Reports", icon: "chart", any: [P.reportsView], group: "Insight" },
  { href: "/audit-logs", label: "Audit log", icon: "scroll", any: [P.auditView], group: "Insight" },
  { href: "/departments", label: "Departments", icon: "building", any: [P.deptView], group: "Administration" },
  { href: "/users", label: "Users", icon: "users", any: [P.usersView], group: "Administration" },
  { href: "/roles", label: "Roles & permissions", icon: "shield", any: [P.rolesView], group: "Administration" },
  { href: "/settings", label: "Settings", icon: "sliders", any: [P.settingsView], group: "Administration" },
];

export function hasAny(held: ReadonlySet<string>, any: readonly string[]) {
  return any.length === 0 || any.some((k) => held.has(k));
}
