import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS, PAYMENT_TIMING, DELIVERY_OPTIONS, labelFor } from "@/lib/po-fields";
import { parseReportParams } from "@/lib/reports";
import { DEPARTMENTS } from "@/lib/po-fields";

// CSV of every PO in the selected period (approvers/admins only; RLS enforces it).
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me || !["approver", "admin"].includes(me.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sp: Record<string, string> = {};
  searchParams.forEach((v, k) => (sp[k] = v));
  const { data: firstRow } = await supabase.from("purchase_orders").select("created_at").order("created_at").limit(1).maybeSingle();
  const params = parseReportParams(sp, new Date(), firstRow ? new Date(firstRow.created_at) : null, DEPARTMENTS);

  let q = supabase
    .from("purchase_orders")
    .select(
      "po_number, status, created_at, decided_at, department, project_name, pay_to, payment_method, payment_timing, needed_by, delivery, items_total, other_charges, total, not_to_exceed, receipt_status, requester:profiles!purchase_orders_requester_id_fkey(email,full_name), approver:profiles!purchase_orders_approver_id_fkey(email,full_name)"
    )
    .gte("created_at", params.from.toISOString())
    .lt("created_at", params.to.toISOString())
    .is("deleted_at", null)
    .order("created_at");
  if (params.department) q = q.eq("department", params.department);
  if (params.requester) q = q.eq("requester_id", params.requester);
  const { data } = await q;

  const header = [
    "PO #", "Status", "Submitted", "Decided", "Requester", "Approver", "Department", "Project",
    "Pay to", "Payment method", "Payment needed", "Need by", "Delivery", "Items total",
    "Other charges", "Total", "Not to exceed", "Receipt",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  type Person = { email: string; full_name: string | null } | null;
  const who = (p: Person) => (p ? p.full_name || p.email : "");

  const lines = [header.join(",")];
  for (const r of data ?? []) {
    const row = r as unknown as Record<string, unknown> & { requester: Person; approver: Person };
    lines.push(
      [
        row.po_number,
        row.status,
        String(row.created_at).slice(0, 10),
        row.decided_at ? String(row.decided_at).slice(0, 10) : "",
        who(row.requester),
        who(row.approver),
        row.department,
        row.project_name,
        row.pay_to,
        labelFor(PAYMENT_METHODS, row.payment_method as string),
        labelFor(PAYMENT_TIMING, row.payment_timing as string),
        row.needed_by,
        row.delivery ? labelFor(DELIVERY_OPTIONS, row.delivery as string) : "",
        row.items_total,
        row.other_charges,
        row.total,
        row.not_to_exceed,
        row.receipt_status === "uploaded" ? "Attached" : "To be turned in",
      ]
        .map(esc)
        .join(",")
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-orders-${params.preset}-${today}.csv"`,
    },
  });
}
