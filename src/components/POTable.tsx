import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { PurchaseOrder } from "@/lib/types";
import { displayName, formatMoney } from "@/lib/types";

export default function POTable({
  orders,
  showRequester = false,
  emptyText = "No purchase orders yet.",
}: {
  orders: PurchaseOrder[];
  showRequester?: boolean;
  emptyText?: string;
}) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">PO #</th>
            <th className="px-4 py-2.5">Project</th>
            <th className="px-4 py-2.5">Pay to</th>
            {showRequester && <th className="px-4 py-2.5">Requester</th>}
            <th className="px-4 py-2.5">Department</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((po) => (
            <tr key={po.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium">
                <Link href={`/po/${po.id}`} className="text-slate-900 hover:underline">
                  PO-{po.po_number}
                </Link>
              </td>
              <td className="px-4 py-2.5">{po.project_name}</td>
              <td className="px-4 py-2.5 text-slate-600">{po.pay_to}</td>
              {showRequester && <td className="px-4 py-2.5">{displayName(po.requester)}</td>}
              <td className="px-4 py-2.5 text-slate-600">{po.department ?? "—"}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(po.total)}</td>
              <td className="px-4 py-2.5">
                <StatusBadge status={po.status} />
              </td>
              <td className="px-4 py-2.5 text-slate-500">
                {new Date(po.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
