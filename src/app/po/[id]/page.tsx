import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CUSTOM_FIELDS, PAYMENT_METHODS, PAYMENT_TIMING, labelFor } from "@/lib/po-fields";
import type { PurchaseOrder } from "@/lib/types";
import { canApprove, displayName, formatMoney } from "@/lib/types";
import { decidePO, deletePO } from "../actions";

export default async function PODetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const { id } = await params;
  const { created, error } = await searchParams;
  const profile = await requireProfile();
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

  let receiptUrl: string | null = null;
  if (po.receipt_path) {
    const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(po.receipt_path, 60 * 60);
    receiptUrl = signed?.signedUrl ?? null;
  }

  const isOwner = po.requester_id === profile.id;
  const canEdit = isOwner && po.status === "pending";
  const canDecide = canApprove(profile.role) && po.status === "pending";

  const address = [po.vendor_street, [po.vendor_city, po.vendor_state].filter(Boolean).join(", "), po.vendor_zip]
    .filter(Boolean)
    .join("\n");

  const timing =
    po.payment_timing === "by_date" && po.needed_by
      ? `Need by ${new Date(po.needed_by + "T00:00:00").toLocaleDateString()}`
      : labelFor(PAYMENT_TIMING, po.payment_timing);

  return (
    <AppShell profile={profile}>
      {created && (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          Purchase order submitted. An approver will review it.
        </p>
      )}
      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">PO-{po.po_number}</h1>
            <StatusBadge status={po.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {[po.project_name, po.department].filter(Boolean).join(" · ")}
          </p>
          <p className="text-sm text-slate-500">
            Submitted by {displayName(po.requester)} on {new Date(po.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/po/${po.id}/print`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Print
          </Link>
          {canEdit && (
            <>
            <Link
              href={`/po/${po.id}/edit`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Edit
            </Link>
            <form action={deletePO.bind(null, po.id)}>
              <button className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                Withdraw
              </button>
            </form>
            </>
          )}
        </div>
      </div>

      {po.status !== "pending" && (
        <section
          className={`mb-6 rounded-lg border p-5 ${
            po.status === "approved" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
          }`}
        >
          <h2 className="font-semibold capitalize">
            {po.status} by {displayName(po.approver)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{po.decided_at && new Date(po.decided_at).toLocaleString()}</p>
          <p className="mt-3 text-sm whitespace-pre-wrap">
            {po.approver_notes || <span className="text-slate-500 italic">No notes.</span>}
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-6">
          <Card title="Request">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Department" value={po.department} />
              <Row label="Project name" value={po.project_name} />
              <Row label="Payment needed" value={timing} />
              <Row label="Payment method" value={labelFor(PAYMENT_METHODS, po.payment_method)} />
            </dl>
          </Card>

          <Card title="Pay to">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Pay to" value={po.pay_to} />
              <Row label="Phone" value={po.vendor_phone} />
              <Row label="Address" value={address} wide />
            </dl>
          </Card>

          <Card title="Purchase details">
            <dl className="grid grid-cols-1 gap-y-3 text-sm mb-4">
              <Row label="Purpose / description" value={po.purpose} wide />
            </dl>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 rounded-l-md">Item</th>
                  <th className="px-3 py-2 text-right rounded-r-md">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(po.line_items ?? []).map((it, i) => (
                  <tr key={it.id ?? i}>
                    <td className="px-3 py-2">{it.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-1.5 pt-3 text-right text-slate-500">Items</td>
                  <td className="px-3 py-1.5 pt-3 text-right tabular-nums">{formatMoney(po.items_total)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 text-right text-slate-500">Other charges</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(po.other_charges)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 text-right font-medium">Total</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatMoney(po.total)}</td>
                </tr>
                {po.not_to_exceed != null && (
                  <tr>
                    <td className="px-3 py-1.5 text-right text-slate-500">Not to exceed</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(po.not_to_exceed)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </Card>

          <Card title="Notes & receipt">
            <dl className="grid grid-cols-1 gap-y-3 text-sm">
              <Row label="Notes / instructions" value={po.notes} wide />
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Receipt</dt>
                <dd className="mt-0.5">
                  {po.receipt_status === "uploaded" && receiptUrl ? (
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-slate-900 underline">
                      View receipt ↗
                    </a>
                  ) : po.receipt_status === "uploaded" ? (
                    <span className="text-slate-500">Uploaded (file unavailable)</span>
                  ) : (
                    <span className="text-amber-800">Requester will turn in the receipt</span>
                  )}
                </dd>
              </div>
              {CUSTOM_FIELDS.map((f) => {
                const v = po.custom_fields?.[f.key];
                const text = f.type === "checkbox" ? (v ? "Yes" : "No") : v == null || v === "" ? null : String(v);
                return <Row key={f.key} label={f.label} value={text} wide />;
              })}
            </dl>
          </Card>
        </section>

        <aside className="space-y-6">
          {canDecide ? (
            <form action={decidePO} className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <input type="hidden" name="id" value={po.id} />
              <h2 className="font-semibold">Decision</h2>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Notes to requester</span>
                <textarea
                  name="notes"
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Required when denying"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  name="decision"
                  value="approved"
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  name="decision"
                  value="denied"
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Deny
                </button>
              </div>
            </form>
          ) : (
            po.status === "pending" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                Awaiting approval.
              </div>
            )
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
