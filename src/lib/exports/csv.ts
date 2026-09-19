import type { RequestRow } from "@/lib/types";
import { REQUEST_EXPORT_COLUMNS, cellValue, type ExportMeta } from "./columns";

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** RFC-4180 CSV with UTF-8 BOM so Excel opens it correctly. */
export function buildCsv(rows: RequestRow[], meta: ExportMeta): Uint8Array {
  const lines: string[] = [];
  lines.push(
    REQUEST_EXPORT_COLUMNS.map((c) => escapeCsv(c.header)).join(",")
  );
  for (const row of rows) {
    lines.push(
      REQUEST_EXPORT_COLUMNS.map((c) => escapeCsv(cellValue(row, c))).join(",")
    );
  }
  const headerComment =
    `# SD Digital Hub — ${meta.scope} requests export\n` +
    `# Generated: ${new Date().toISOString()} (UTC) by ${meta.generatedBy}\n` +
    `# Filters: ${meta.filtersSummary}\n` +
    `# Rows: ${meta.count}\n`;
  // Comments would break strict CSV parsers → keep the file pure CSV.
  void headerComment;
  const content = "\uFEFF" + lines.join("\r\n") + "\r\n";
  return new TextEncoder().encode(content);
}
