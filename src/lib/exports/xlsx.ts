import ExcelJS from "exceljs";
import type { RequestRow } from "@/lib/types";
import { REQUEST_EXPORT_COLUMNS, cellValue, type ExportMeta } from "./columns";

/** Excel (.xlsx) export with frozen header, filters and styled columns. */
export async function buildXlsx(rows: RequestRow[], meta: ExportMeta): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SD Digital Hub — Admin Panel";
  wb.created = new Date();

  const ws = wb.addWorksheet(`${meta.scope.slice(0, 25)} requests`, {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Row 1: metadata
  ws.mergeCells(1, 1, 1, REQUEST_EXPORT_COLUMNS.length);
  const metaCell = ws.getCell(1, 1);
  metaCell.value = `SD Digital Hub — ${meta.scope} requests · ${rows.length} row(s) · filters: ${meta.filtersSummary} · generated ${new Date().toISOString()} (UTC)`;
  metaCell.font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  // Row 2: header
  ws.columns = REQUEST_EXPORT_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: Math.min(60, Math.max(10, c.width / 1.4)),
  }));
  const headerRow = ws.getRow(2);
  headerRow.values = REQUEST_EXPORT_COLUMNS.map((c) => c.header);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF312E81" } } };
  });

  const statusColors: Record<string, string> = {
    pending: "FFB45309",
    completed: "FF047857",
    cancelled: "FFBE123C",
  };

  rows.forEach((row) => {
    const values = REQUEST_EXPORT_COLUMNS.map((c) => cellValue(row, c));
    const r = ws.addRow(values);
    r.alignment = { vertical: "top", wrapText: false };
    const statusCell = r.getCell(REQUEST_EXPORT_COLUMNS.findIndex((c) => c.key === "status") + 1);
    const color = statusColors[String(statusCell.value ?? "").toLowerCase()];
    if (color) statusCell.font = { bold: true, color: { argb: color } };
  });

  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2 + rows.length, column: REQUEST_EXPORT_COLUMNS.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
