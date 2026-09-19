import PDFDocument from "pdfkit";
import type { RequestRow } from "@/lib/types";
import { cleanIsoDate } from "@/lib/format";
import type { ExportMeta } from "./columns";

interface PdfCol {
  header: string;
  width: number;
  get: (r: RequestRow) => string;
}

const COLS: PdfCol[] = [
  { header: "ID", width: 62, get: (r) => (r.request_id || "").slice(0, 8) },
  { header: "Type", width: 48, get: (r) => r.request_type },
  { header: "Status", width: 56, get: (r) => r.status || "—" },
  { header: "Name", width: 86, get: (r) => r.name || "—" },
  { header: "Email", width: 118, get: (r) => r.email || "—" },
  { header: "Phone", width: 74, get: (r) => r.phone || "—" },
  { header: "Business", width: 86, get: (r) => r.business_name || "—" },
  { header: "Service", width: 92, get: (r) => r.service_name || "—" },
  { header: "Created (UTC)", width: 96, get: (r) => cleanIsoDate(r.created_at).replace(" UTC", "") },
];

const PAGE_W = 842; // A4 landscape
const PAGE_H = 595;
const MARGIN = 30;
const TABLE_W = COLS.reduce((a, c) => a + c.width, 0);

const STATUS_COLORS: Record<string, [number, number, number]> = {
  pending: [180, 83, 9],
  completed: [4, 120, 87],
  cancelled: [190, 18, 60],
};

function truncate(doc: PDFKit.PDFDocument, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
  return `${t}…`;
}

/** PDF export: branded header, filter summary, tabular rows, page numbers. */
export function buildPdf(rows: RequestRow[], meta: ExportMeta): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: MARGIN,
        bufferPages: true,
        info: {
          Title: `SD Digital Hub — ${meta.scope} requests`,
          Author: "SD Digital Hub Admin Panel",
          Subject: `Filtered export (${meta.filtersSummary})`,
          CreationDate: new Date(),
        },
      });

      const chunks: Uint8Array[] = [];
      doc.on("data", (c: Buffer) => chunks.push(new Uint8Array(c)));
      doc.on("error", reject);
      doc.on("end", () => {
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { out.set(c, off); off += c.length; }
        resolve(out);
      });

      const drawHeader = () => {
        doc.rect(0, 0, PAGE_W, 74).fill("#0f172a");
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16)
          .text("SD DIGITAL HUB", MARGIN, 18);
        doc.font("Helvetica").fontSize(10).fillColor("#c7d2fe")
          .text(`${meta.scope.toUpperCase()} REQUESTS — ${rows.length} record(s)`, MARGIN, 40);
        doc.fontSize(8).fillColor("#94a3b8")
          .text(`Filters: ${meta.filtersSummary}`, MARGIN, 55, { width: TABLE_W });
        doc.text(`Generated: ${new Date().toISOString()} (UTC) · by ${meta.generatedBy}`,
          PAGE_W - MARGIN - 260, 55, { width: 260, align: "right" });
        doc.fillColor("#111827");
      };

      const drawTableHeader = (y: number): number => {
        doc.rect(MARGIN, y, TABLE_W, 20).fill("#eef2ff");
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#312e81");
        let x = MARGIN + 4;
        for (const c of COLS) {
          doc.text(c.header.toUpperCase(), x, y + 6, { width: c.width - 8, lineBreak: false });
          x += c.width;
        }
        doc.fillColor("#111827");
        return y + 20;
      };

      drawHeader();
      let y = drawTableHeader(88);
      doc.font("Helvetica").fontSize(8);

      rows.forEach((row, idx) => {
        const details = row.details ? truncate(doc, row.details.replace(/\s+/g, " "), TABLE_W - 40) : "";
        const rowH = details ? 30 : 18;

        if (y + rowH > PAGE_H - 34) {
          doc.addPage();
          drawHeader();
          y = drawTableHeader(88);
          doc.font("Helvetica").fontSize(8);
        }

        if (idx % 2 === 1) {
          doc.rect(MARGIN, y, TABLE_W, rowH).fill("#f8fafc");
          doc.fillColor("#111827");
        }

        let x = MARGIN + 4;
        for (const c of COLS) {
          if (c.header === "Status") {
            const rgb = STATUS_COLORS[(row.status || "").toLowerCase()] ?? [71, 85, 105];
            doc.fillColor(`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`).font("Helvetica-Bold");
          }
          doc.text(truncate(doc, c.get(row), c.width - 8), x, y + 5, {
            width: c.width - 8, lineBreak: false,
          });
          if (c.header === "Status") {
            doc.fillColor("#111827").font("Helvetica");
          }
          x += c.width;
        }

        if (details) {
          doc.fillColor("#64748b").font("Helvetica-Oblique")
            .text(`↳ ${details}`, MARGIN + 12, y + 17, { width: TABLE_W - 40, lineBreak: false });
          doc.fillColor("#111827").font("Helvetica");
        }

        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + TABLE_W, y + rowH)
          .strokeColor("#e2e8f0").lineWidth(0.5).stroke();
        y += rowH;
      });

      // Page numbers (buffered pages).
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(8).fillColor("#94a3b8");
        doc.text(
          `SD Digital Hub — Admin Panel export · page ${i + 1} of ${range.count}`,
          MARGIN, PAGE_H - 22, { width: TABLE_W, align: "center" }
        );
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
