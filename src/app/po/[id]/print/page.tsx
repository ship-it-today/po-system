import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DELIVERY_OPTIONS, ORG_NAME, PAYMENT_METHODS, PAYMENT_TIMING, labelFor } from "@/lib/po-fields";
import type { PurchaseOrder } from "@/lib/types";
import { displayName, formatMoney } from "@/lib/types";
import PrintButton from "./PrintButton";

export default async function PrintPOPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select(
      "*, line_items:po_line_items(*), requester:profiles!purchase_orders_requester_id_fkey(id,email,full_name), approver:profiles!purchase_orders_approver_id_fkey(id,email,full_name)"
    )
    .eq("id", id)
    .order("position", { referencedTable: "po_line_items" })
    .single();
  if (!data) notFound();
  const po = data as PurchaseOrder;

  const address = [po.vendor_street, [po.vendor_city, po.vendor_state].filter(Boolean).join(", "), po.vendor_zip]
    .filter(Boolean)
    .join("\n");
  const timing =
    po.payment_timing === "by_date" && po.needed_by
      ? `Need by ${new Date(po.needed_by + "T00:00:00").toLocaleDateString()}`
      : labelFor(PAYMENT_TIMING, po.payment_timing);
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "");

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between print:hidden">
        <Link href={`/po/${po.id}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to PO-{po.po_number}
        </Link>
        <PrintButton />
      </div>

      <main className="max-w-3xl mx-auto bg-white text-slate-900 p-10 print:p-0 print:max-w-none shadow-sm print:shadow-none text-[13px] leading-snug">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <div className="text-lg font-bold">{ORG_NAME}</div>
            <div className="text-slate-600">Purchase Order Request</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">PO-{po.po_number}</div>
            <div className="text-slate-600">Submitted {fmtDate(po.created_at)}</div>
            <div className="mt-1 inline-block rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
              {po.status}
            </div>
          </div>
        </div>

        {/* Request + Pay to */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-300 pb-1 mb-2">
              Request
            </h2>
            <Row label="Requested by" value={displayName(po.requester)} />
            <Row label="Email" value={po.requester?.email} />
            <Row label="Department" value={po.department} />
            <Row label="Project" value={po.project_name} />
            <Row label="Payment needed" value={timing} />
            <Row label="Payment method" value={labelFor(PAYMENT_METHODS, po.payment_method)} />
            <Row label="Delivery" value={po.delivery ? labelFor(DELIVERY_OPTIONS, po.delivery) : null} />
          </section>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-300 pb-1 mb-2">
              Pay to
            </h2>
            <Row label="Payee" value={po.pay_to} />
            <Row label="Address" value={address} />
            <Row label="Phone" value={po.vendor_phone} />
          </section>
        </div>

        {/* Purpose */}
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-300 pb-1 mb-2">
            Purpose / description
          </h2>
          <p className="whitespace-pre-wrap">{po.purpose || "—"}</p>
        </section>

        {/* Items */}
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-300 pb-1 mb-2">
            Itemized purchase details
          </h2>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 font-semibold">Item</th>
                <th className="py-1 font-semibold text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(po.line_items ?? []).map((it, i) => (
                <tr key={it.id ?? i} className="border-t border-slate-200">
                  <td className="py-1.5">{it.description}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300">
                <td className="py-1 text-right text-slate-600">Items subtotal</td>
                <td className="py-1 text-right tabular-nums">{formatMoney(po.items_total)}</td>
              </tr>
              <tr>
                <td className="py-1 text-right text-slate-600">Other charges</td>
                <td className="py-1 text-right tabular-nums">{formatMoney(po.other_charges)}</td>
              </tr>
              <tr className="border-t-2 border-slate-900">
                <td className="py-1.5 text-right font-bold">Total</td>
                <td className="py-1.5 text-right font-bold tabular-nums">{formatMoney(po.total)}</td>
              </tr>
              {po.not_to_exceed != null && (
                <tr>
                  <td className="py-1 text-right text-slate-600">Not to exceed</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(po.not_to_exceed)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </section>

        {/* Notes + receipt */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-300 pb-1 mb-2">
              Notes / instructions
            </h2>
            <p className="whitespace-pre-wrap">{po.notes || "—"}</p>
          </section>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-300 pb-1 mb-2">
              Receipt
            </h2>
            <p>{po.receipt_status === "uploaded" ? "☑ Receipt attached (see online record)" : "☐ Receipt to be turned in"}</p>
          </section>
        </div>

        {/* Approval */}
        <section className="border border-slate-300 rounded p-4 mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Approval</h2>
          {po.status === "pending" ? (
            <p className="text-slate-600">Awaiting approval.</p>
          ) : (
            <>
              <p>
                <span className="font-semibold capitalize">{po.status}</span> by {displayName(po.approver)} on{" "}
                {fmtDate(po.decided_at)}
              </p>
              {po.approver_notes && <p className="mt-1 whitespace-pre-wrap text-slate-700">{po.approver_notes}</p>}
            </>
          )}
        </section>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-10">
          <div>
            <div className="border-b border-slate-900 h-8" />
            <div className="text-xs text-slate-500 mt-1">Requester signature / date</div>
          </div>
          <div>
            <div className="border-b border-slate-900 h-8" />
            <div className="text-xs text-slate-500 mt-1">Approver signature / date</div>
          </div>
        </div>

        <div className="mt-8 text-[10px] text-slate-400 print:block">
          PO-{po.po_number} · Printed {new Date().toLocaleDateString()}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2 py-0.5">
      <div className="w-32 shrink-0 text-slate-500">{label}</div>
      <div className="whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}
