import type { AdminMe, Permission, Role } from "./types";

/**
 * UI mirror of the DB-side permission matrix (public.admin_can()).
 * The DATABASE is the source of truth — every RPC re-checks permissions.
 * This file only decides which buttons/sections to show.
 */

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  support: "Support",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin:
    "Full control: requests, status, deletes, exports, website & social settings, blocked IPs, admin accounts, security and audit logs.",
  admin:
    "View requests, update status, export data, view website information. Delete requests only if granted. No admin-user or security management.",
  support:
    "View requests and sessions. Update status only if granted. No deletes, exports, settings, security or admin management.",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_requests: "View requests",
  update_status: "Update request status",
  delete_requests: "Delete requests",
  export_data: "Export data (CSV/XLSX/XML/PDF)",
  view_settings: "View website information",
  manage_settings: "Manage website settings & social links",
  view_sessions: "View website sessions",
  view_blocked_ips: "View blocked IPs",
  manage_blocked_ips: "Block / unblock IPs",
  view_audit: "View audit logs",
  manage_admins: "Manage admin accounts",
};

export function can(admin: AdminMe | null | undefined, perm: Permission): boolean {
  return Boolean(admin?.permissions?.includes(perm));
}

export function isSuperAdmin(admin: AdminMe | null | undefined): boolean {
  return admin?.role === "super_admin";
}
