import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS, PAYMENT_TIMING, DELIVERY_OPTIONS, labelFor } from "@/lib/po-fields";
import { makeBuckets, parsePeriod } from "@/lib/reports";

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
  const period = parsePeriod(searchParams.get("period") ?? undefined);
  const buckets = makeBuckets(period);

  const { data } = await supabase
    .from("purchase_orders")
    .select(
      "po_number, status, created_at, decided_at, department, project_name, pay_to, payment_method, payment_timing, needed_by, delivery, items_total, other_charges, total, not_to_exceed, receipt_status, requester:profiles!purchase_orders_requester_id_fkey(email,full_name), approver:profiles!purchase_orders_approver_id_fkey(email,full_name)"
    )
    .gte("created_at", buckets[0].start.toISOString())
    .order("created_at");

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
      "Content-Disposition": `attachment; filename="purchase-orders-${period}-${today}.csv"`,
    },
  });
}
