import Link from "next/link";
import AppShell from "@/components/AppShell";
import POTable from "@/components/POTable";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { POStatus, PurchaseOrder } from "@/lib/types";

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

  return (
    <AppShell profile={profile}>
      <h1 className="text-xl font-semibold mb-4">Approvals</h1>
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
