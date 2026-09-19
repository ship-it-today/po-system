import Link from "next/link";
import AppShell from "@/components/AppShell";
import POTable from "@/components/POTable";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, type POStatus, type PurchaseOrder } from "@/lib/types";

const TABS: { key: POStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "denied", label: "Denied" },
  { key: "all", label: "All" },
];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireRole(["approver", "admin"]);
  const { status: raw } = await searchParams;
  const status = (TABS.some((t) => t.key === raw) ? raw : "pending") as POStatus | "all";
  const supabase = await createClient();

  let query = supabase
    .from("purchase_orders")
    .select("*, requester:profiles!purchase_orders_requester_id_fkey(id,email,full_name)")
    .order("created_at", { ascending: status === "pending" });
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query;
  const orders = (data ?? []) as PurchaseOrder[];

  const { data: allRows } = await supabase.from("purchase_orders").select("status, total");
  const summary = (allRows ?? []).reduce(
    (acc, r) => {
      acc[r.status as POStatus].count += 1;
      acc[r.status as POStatus].total += Number(r.total) || 0;
      return acc;
    },
    { pending: { count: 0, total: 0 }, approved: { count: 0, total: 0 }, denied: { count: 0, total: 0 } }
  );
  const isAdmin = profile.role === "admin";

  return (
    <AppShell profile={profile}>
      <h1 className="text-xl font-semibold mb-1">{isAdmin ? "All purchase orders" : "Approvals"}</h1>
      <p className="text-sm text-slate-500 mb-4">
        {summary.pending.count} pending ({formatMoney(summary.pending.total)}) · {summary.approved.count} approved (
        {formatMoney(summary.approved.total)}) · {summary.denied.count} denied
      </p>
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/approvals?status=${t.key}`}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${
              status === t.key
                ? "border-slate-900 text-slate-900 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <POTable
        orders={orders}
        showRequester
        emptyText={status === "pending" ? "Nothing waiting for approval." : "No purchase orders here."}
      />
    </AppShell>
  );
}
