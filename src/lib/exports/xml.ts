import type { RequestRow } from "@/lib/types";
import { REQUEST_EXPORT_COLUMNS, cellValue, type ExportMeta } from "./columns";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Strip control characters that are invalid in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

export function buildXml(rows: RequestRow[], meta: ExportMeta): Uint8Array {
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    `<requests exported_at="${new Date().toISOString()}" scope="${escapeXml(meta.scope)}" ` +
      `count="${rows.length}" filters="${escapeXml(meta.filtersSummary)}" ` +
      `generated_by="${escapeXml(meta.generatedBy)}">`
  );
  for (const row of rows) {
    parts.push("  <request>");
    for (const col of REQUEST_EXPORT_COLUMNS) {
      const value = cellValue(row, col);
      parts.push(`    <${col.key}>${escapeXml(value)}</${col.key}>`);
    }
    parts.push("  </request>");
  }
  parts.push("</requests>");
  return new TextEncoder().encode(parts.join("\n") + "\n");
}
