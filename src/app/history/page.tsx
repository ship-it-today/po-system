import Link from "next/link";
import AppShell from "@/components/AppShell";
import POFilters from "@/components/POFilters";
import POTable from "@/components/POTable";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseListParams, queryPOs, type RawSearchParams } from "@/lib/po-query";
import type { PurchaseOrder } from "@/lib/types";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const profile = await requireProfile();
  const params = parseListParams(await searchParams);
  const supabase = await createClient();

  const [{ rows, total }, { data: allMine }] = await Promise.all([
    queryPOs(supabase, params, { requesterId: profile.id }),
    supabase.from("purchase_orders").select("status").eq("requester_id", profile.id),
  ]);
  const orders = rows as PurchaseOrder[];
  const counts = { pending: 0, approved: 0, denied: 0 };
  for (const r of allMine ?? []) counts[r.status as keyof typeof counts] += 1;

  return (
    <AppShell profile={profile}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">My purchase orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {counts.pending} pending · {counts.approved} approved · {counts.denied} denied
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New purchase order
        </Link>
      </div>
      <POFilters basePath="/history" params={params} />
      <POTable
        orders={orders}
        total={total}
        params={params}
        basePath="/history"
        emptyText={
          total === 0 && !params.q && !params.status && !params.department && !params.from && !params.to
            ? "You haven't submitted any purchase orders yet."
            : "No purchase orders match these filters."
        }
      />
    </AppShell>
  );
}
