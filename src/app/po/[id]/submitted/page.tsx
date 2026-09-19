import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS, labelFor } from "@/lib/po-fields";
import type { PurchaseOrder } from "@/lib/types";
import { formatMoney } from "@/lib/types";

export default async function SubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_number, pay_to, department, project_name, total, payment_method, receipt_status")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const po = data as Pick<
    PurchaseOrder,
    "id" | "po_number" | "pay_to" | "department" | "project_name" | "total" | "payment_method" | "receipt_status"
  >;

  return (
    <AppShell profile={profile}>
      <div className="max-w-lg mx-auto text-center pt-6">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold">Purchase order submitted</h1>
        <p className="text-slate-600 mt-2">
          <span className="font-medium text-slate-900">PO-{po.po_number}</span> is now waiting for an approver. You&apos;ll
          see its status under My POs.
        </p>

        <dl className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-left text-sm grid grid-cols-2 gap-x-4 gap-y-3">
          <Item label="Pay to" value={po.pay_to} />
          <Item label="Total" value={formatMoney(po.total)} />
          <Item label="Department" value={po.department} />
          <Item label="Payment method" value={labelFor(PAYMENT_METHODS, po.payment_method)} />
          {po.project_name && <Item label="Project" value={po.project_name} />}
          <Item
            label="Receipt"
            value={po.receipt_status === "uploaded" ? "Attached" : "To be turned in"}
          />
        </dl>

        {po.receipt_status === "will_turn_in" && (
          <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Reminder: you chose to turn in the receipt. Please drop it off once you have it.
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Start another PO
          </Link>
          <Link
            href={`/po/${po.id}`}
            className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            View PO-{po.po_number}
          </Link>
          <Link
            href="/history"
            className="rounded-md px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            My POs
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
