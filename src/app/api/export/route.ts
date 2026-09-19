import { NextResponse, type NextRequest } from "next/server";
import { getGuardedAdmin } from "@/lib/auth-guard";
import { isSupabaseConfigured } from "@/lib/env";
import { exportRequestsArgs, parseRequestFilters } from "@/lib/query";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { Paged, RequestRow, RequestType } from "@/lib/types";
import { buildCsv } from "@/lib/exports/csv";
import { buildXml } from "@/lib/exports/xml";
import { buildXlsx } from "@/lib/exports/xlsx";
import { buildPdf } from "@/lib/exports/pdf";
import { exportFileName, type ExportMeta } from "@/lib/exports/columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS = ["csv", "xlsx", "xml", "pdf"] as const;
type Format = (typeof FORMATS)[number];

const CONTENT_TYPES: Record<Format, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml; charset=utf-8",
  pdf: "application/pdf",
};

function summarizeFilters(params: URLSearchParams): string {
  const bits: string[] = [];
  const type = params.get("type");
  if (type) bits.push(`type=${type}`);
  const status = params.get("status");
  if (status) bits.push(`status=${status}`);
  const q = params.get("q");
  if (q) bits.push(`search="${q}"`);
  const from = params.get("from");
  const to = params.get("to");
  if (from || to) bits.push(`date=${from || "…"}→${to || "…"}`);
  const service = params.get("service");
  if (service) bits.push(`service=${service}`);
  const source = params.get("source");
  if (source) bits.push(`source=${source}`);
  if (params.get("ids")) bits.push("selected-only");
  return bits.length ? bits.join(", ") : "none (all records)";
}

/**
 * GET /api/export?format=csv|xlsx|xml|pdf&...same filter params as the table...
 *
 * Exports respect the ACTIVE FILTERS exactly (spec §23) because the same
 * parseRequestFilters() drives both the on-screen table and this route.
 * `ids=service:ID,contact:ID` exports only the selected rows.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Admin Panel is not configured." }, { status: 500 });
  }

  const guard = await getGuardedAdmin("export_data");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
  }
  const { supabase, admin } = guard;

  const { searchParams } = req.nextUrl;
  const formatRaw = (searchParams.get("format") || "csv").toLowerCase();
  if (!FORMATS.includes(formatRaw as Format)) {
    return NextResponse.json({ error: "Unsupported format. Use csv, xlsx, xml or pdf." }, { status: 400 });
  }
  const format = formatRaw as Format;

  const scopeParam = searchParams.get("scope") || "all";
  const scope: "all" | RequestType = (["all", "service", "contact", "callback"] as const).includes(
    scopeParam as "all" | RequestType
  )
    ? (scopeParam as "all" | RequestType)
    : "all";

  const sp: Record<string, string | undefined> = {};
  searchParams.forEach((v, k) => { sp[k] = v; });
  const filters = parseRequestFilters(sp, scope);

  // ---- Selection export: ids arrive as "type:id" pairs ---------------------
  const idsParam = searchParams.get("ids");
  let rows: RequestRow[] = [];

  if (idsParam) {
    const pairs = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const byType = new Map<RequestType, string[]>();
    for (const pair of pairs) {
      const idx = pair.indexOf(":");
      if (idx < 0) continue;
      const t = pair.slice(0, idx) as RequestType;
      const id = pair.slice(idx + 1);
      if (!["service", "contact", "callback"].includes(t) || !id) continue;
      byType.set(t, [...(byType.get(t) ?? []), id]);
    }
    if (!byType.size) {
      return NextResponse.json({ error: "No valid selections received." }, { status: 400 });
    }
    // One RPC per type → exact rows, even if numeric IDs collide across tables.
    for (const [t, ids] of byType) {
      const { data, error } = await supabase.rpc(
        "admin_export_requests",
        exportRequestsArgs({ ...filters, types: [t], statuses: null }, ids)
      );
      if (error) {
        logRpcError("export selected", error);
        return NextResponse.json({ error: rpcErrorText(error) }, { status: 400 });
      }
      rows.push(...((data ?? []) as RequestRow[]));
    }
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  } else {
    const { data, error } = await supabase.rpc("admin_export_requests", exportRequestsArgs(filters));
    if (error) {
      logRpcError("admin_export_requests", error);
      return NextResponse.json({ error: rpcErrorText(error) }, { status: 400 });
    }
    rows = (data ?? []) as RequestRow[];
  }

  const meta: ExportMeta = {
    scope,
    format,
    count: rows.length,
    filtersSummary: summarizeFilters(searchParams),
    generatedBy: admin.email,
  };

  let body: Uint8Array;
  switch (format) {
    case "xlsx": body = await buildXlsx(rows, meta); break;
    case "xml":  body = buildXml(rows, meta); break;
    case "pdf":  body = await buildPdf(rows, meta); break;
    default:     body = buildCsv(rows, meta);
  }

  // Audit the export (best effort).
  try {
    await supabase.rpc("admin_record_audit", {
      p_action: "data.export",
      p_section: "requests",
      p_record_id: null,
      p_details: { format, scope, rows: rows.length, filters: meta.filtersSummary },
    });
  } catch (e) {
    logRpcError("audit export", e);
  }

  return new NextResponse(Buffer.from(body), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${exportFileName(scope, format)}"`,
      "Cache-Control": "no-store",
    },
  });
}
