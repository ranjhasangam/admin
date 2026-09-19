export type Role = "super_admin" | "admin" | "support";

export type RequestType = "service" | "contact" | "callback";

export type RequestStatus = "pending" | "completed" | "cancelled";

export type Permission =
  | "view_requests"
  | "update_status"
  | "delete_requests"
  | "export_data"
  | "view_settings"
  | "manage_settings"
  | "view_sessions"
  | "view_blocked_ips"
  | "manage_blocked_ips"
  | "view_audit"
  | "manage_admins";

export const ALL_PERMISSIONS: Permission[] = [
  "view_requests",
  "update_status",
  "delete_requests",
  "export_data",
  "view_settings",
  "manage_settings",
  "view_sessions",
  "view_blocked_ips",
  "manage_blocked_ips",
  "view_audit",
  "manage_admins",
];

/** Shape returned by the admin_session_me() RPC. */
export interface AdminMe {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  can_delete_requests: boolean;
  can_update_status: boolean;
  last_login_at: string | null;
  permissions: Permission[];
}

/** One row of the unified request read-model (admin_all_requests view). */
export interface RequestRow {
  request_type: RequestType;
  request_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  service_name: string | null;
  details: string | null;
  source_section: string | null;
  price_info: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Paged<T> {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  rows: T[];
}

export type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "status" | "updated";

export interface RequestFilters {
  scope: "all" | RequestType;
  types: RequestType[] | null;
  statuses: string[] | null;
  search: string | null;
  date_from: string | null;
  date_to: string | null;
  service: string | null;
  source: string | null;
  sort: SortKey;
  page: number;
  page_size: number;
}

export interface FilterOptions {
  services: { name: string; count: number }[];
  sources: { name: string; count: number }[];
  statuses: { name: string; count: number }[];
  date_min: string | null;
  date_max: string | null;
}

export interface DashboardData {
  requests: {
    total: number;
    service: number;
    contact: number;
    callback: number;
    pending: number;
    completed: number;
    cancelled: number;
    today: number;
    last7: number;
    last30: number;
  };
  sessions: {
    total: number;
    active: number;
    today: number;
    last7: number;
    last30: number;
  };
  blocked_ips: { active: number; total: number };
  recent_requests: RequestRow[];
  trend_14d: { date: string; count: number }[];
  by_service: { service: string; count: number }[];
  recent_blocks: {
    id: string;
    ip_hash_prefix: string;
    label: string | null;
    reason: string | null;
    created_at: string;
    blocked_by_email: string | null;
  }[];
  recent_audit: {
    action: string;
    section: string | null;
    admin_email: string | null;
    record_id: string | null;
    created_at: string;
  }[];
  admins: { total: number; active: number };
}

export interface AnalyticsData {
  days: number;
  totals: { total: number; service: number; contact: number; callback: number };
  status: { pending: number; completed: number; cancelled: number };
  daily: { date: string; total: number; service: number; contact: number; callback: number }[];
  by_service: { name: string; count: number; pending: number; completed: number; cancelled: number }[];
  by_source: { name: string; count: number }[];
  sessions: { total: number; active: number; today: number; last7: number; last30: number };
  sessions_daily: { date: string; count: number }[];
}

export interface SessionRow {
  session_id: string | null;
  created_at: string | null;
  last_seen: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  ip_hash: string | null;
  user_agent: string | null;
  referrer: string | null;
}

export interface BlockedIpRow {
  id: string;
  ip_hash: string;
  label: string | null;
  reason: string | null;
  is_active: boolean;
  expires_at: string | null;
  blocked_by: string | null;
  blocked_by_email: string | null;
  created_at: string;
  currently_blocked?: boolean;
}

export interface AuditRow {
  id: number;
  admin_id: string | null;
  admin_email: string | null;
  admin_name?: string | null;
  action: string;
  section: string | null;
  record_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface SocialLinkRow {
  id: string;
  platform: string;
  url: string;
  label: string | null;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  can_delete_requests: boolean;
  can_update_status: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Standard shape returned by every server action. */
export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export const SETTINGS_KEYS = [
  "business_name",
  "business_description",
  "phone",
  "email",
  "whatsapp",
  "address",
  "city",
  "state",
  "pincode",
  "country",
] as const;

export type SettingKey = (typeof SETTINGS_KEYS)[number];

export type SettingsMap = Partial<Record<SettingKey, string | null>>;
