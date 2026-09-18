import Link from "next/link";
import AppShell from "@/components/AppShell";
import POTable from "@/components/POTable";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseOrder } from "@/lib/types";

export default async function MyPOsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireProfile();
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("requester_id", profile.id)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as PurchaseOrder[];
  const counts = {
    pending: orders.filter((o) => o.status === "pending").length,
    approved: orders.filter((o) => o.status === "approved").length,
    denied: orders.filter((o) => o.status === "denied").length,
  };

  return (
    <AppShell profile={profile}>
      {error === "forbidden" && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          You don&apos;t have access to that page.
        </p>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">My purchase orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {counts.pending} pending · {counts.approved} approved · {counts.denied} denied
          </p>
        </div>
        <Link
          href="/po/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New purchase order
        </Link>
      </div>
      <POTable orders={orders} emptyText="You haven't submitted any purchase orders yet." />
    </AppShell>
  );
}
