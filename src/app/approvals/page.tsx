import Link from "next/link";
import AppShell from "@/components/AppShell";
import POFilters from "@/components/POFilters";
import POTable from "@/components/POTable";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseListParams, queryPOs, toQuery, type RawSearchParams } from "@/lib/po-query";
import { displayName, formatMoney, type POStatus, type PurchaseOrder } from "@/lib/types";

const TABS: { key: POStatus | ""; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "denied", label: "Denied" },
  { key: "", label: "All" },
];

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const profile = await requireRole(["approver", "admin"]);
  const raw = await searchParams;
  // Default to the pending queue, oldest first, unless the URL says otherwise.
  const hasStatusParam = "status" in raw;
  const params = parseListParams(raw, {
    status: hasStatusParam ? "" : "pending",
    sort: "created_at",
    dir: !hasStatusParam || raw.status === "pending" ? "asc" : "desc",
  });
  const supabase = await createClient();

  const [{ rows, total }, { data: allRows }, { data: people }] = await Promise.all([
    queryPOs(supabase, params),
    supabase.from("purchase_orders").select("status, total"),
    supabase.from("profiles").select("id, email, full_name").order("full_name"),
  ]);
  const orders = rows as PurchaseOrder[];

  const summary = (allRows ?? []).reduce(
    (acc, r) => {
      acc[r.status as POStatus].count += 1;
      acc[r.status as POStatus].total += Number(r.total) || 0;
      return acc;
    },
    { pending: { count: 0, total: 0 }, approved: { count: 0, total: 0 }, denied: { count: 0, total: 0 } }
  );
  const requesters = (people ?? []).map((p) => ({ id: p.id, label: displayName(p) }));
  const isAdmin = profile.role === "admin";

  return (
    <AppShell profile={profile}>
      <h1 className="text-xl font-semibold mb-1">{isAdmin ? "All Purchase Orders" : "Approvals"}</h1>
      <p className="text-sm text-slate-500 mb-4">
        {summary.pending.count} pending ({formatMoney(summary.pending.total)}) · {summary.approved.count} approved (
        {formatMoney(summary.approved.total)}) · {summary.denied.count} denied
      </p>
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key || "all"}
            href={`/approvals?status=${t.key}`}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${
              params.status === t.key
                ? "border-slate-900 text-slate-900 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <POFilters basePath="/approvals" params={params} requesters={requesters} />
      <POTable
        orders={orders}
        total={total}
        params={params}
        basePath="/approvals"
        showRequester
        emptyText={params.status === "pending" && !params.q ? "Nothing waiting for approval." : "No purchase orders match these filters."}
      />
      {total > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Tip: bookmark a filtered view, e.g.{" "}
          <Link href={`/approvals${toQuery({ status: "approved", sort: "total", dir: "desc" })}`} className="underline">
            approved, largest first
          </Link>
          .
        </p>
      )}
    </AppShell>
  );
}
