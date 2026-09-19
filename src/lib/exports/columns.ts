import { cleanIsoDate } from "@/lib/format";
import type { RequestRow } from "@/lib/types";

export interface ExportColumn {
  key: string;
  header: string;
  width: number;
  date?: boolean;
}

/** Column set shared by CSV / XLSX / XML / PDF exports. */
export const REQUEST_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "request_id", header: "Request ID", width: 38 },
  { key: "request_type", header: "Type", width: 10 },
  { key: "status", header: "Status", width: 12 },
  { key: "name", header: "Name", width: 24 },
  { key: "email", header: "Email", width: 30 },
  { key: "phone", header: "Phone", width: 16 },
  { key: "business_name", header: "Business Name", width: 24 },
  { key: "service_name", header: "Service", width: 26 },
  { key: "source_section", header: "Source Section", width: 18 },
  { key: "price_info", header: "Price Info", width: 16 },
  { key: "details", header: "Details / Message", width: 60 },
  { key: "created_at", header: "Created At", width: 22, date: true },
  { key: "updated_at", header: "Updated At", width: 22, date: true },
];

export function cellValue(row: RequestRow, col: ExportColumn): string {
  const raw = (row as unknown as Record<string, unknown>)[col.key];
  if (raw === null || raw === undefined) return "";
  const s = String(raw);
  return col.date ? cleanIsoDate(s) : s;
}

export function exportFileName(scope: string, format: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return `sd-${scope}-requests-${stamp}.${format}`;
}

export interface ExportMeta {
  scope: string;
  format: string;
  count: number;
  filtersSummary: string;
  generatedBy: string;
}
