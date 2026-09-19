import Link from "next/link";
import AppShell from "@/components/AppShell";
import POForm from "@/components/POForm";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove, type PurchaseOrder } from "@/lib/types";
import { createPO } from "./po/actions";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const profile = await requireProfile();
  const { error, from } = await searchParams;
  const supabase = await createClient();

  const [{ count: pendingCount }, { count: queueCount }, { data: payeeRows }, { data: template }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", profile.id)
      .eq("status", "pending")
      .is("deleted_at", null),
    canApprove(profile.role)
      ? supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
    supabase.from("purchase_orders").select("pay_to").is("deleted_at", null).order("created_at", { ascending: false }).limit(300),
    from
      ? supabase
          .from("purchase_orders")
          .select("*, line_items:po_line_items(*)")
          .eq("id", from)
          .order("position", { referencedTable: "po_line_items" })
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const payees = [...new Set((payeeRows ?? []).map((r) => r.pay_to).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  const initial = (template as PurchaseOrder | null) ?? undefined;

  return (
    <AppShell profile={profile}>
      {error === "forbidden" && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          You don&apos;t have access to that page.
        </p>
      )}
      {canApprove(profile.role) && (queueCount ?? 0) > 0 && (
        <Link
          href="/approvals"
          className="mb-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <span>
            <span className="font-semibold">{queueCount}</span> purchase order{queueCount === 1 ? "" : "s"} waiting for
            approval
          </span>
          <span className="font-medium">Review →</span>
        </Link>
      )}
      {initial && (
        <p className="mb-4 text-sm text-slate-800 bg-slate-100 border border-slate-200 rounded-md px-3 py-2">
          Starting from a copy of <span className="font-medium">PO-{initial.po_number}</span>. Change anything you need,
          then submit as a new request.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold">New Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fill out the form below and submit it for approval.</p>
        </div>
        <Link href="/history" className="text-sm text-slate-700 underline hover:text-slate-900">
          View My PO History{pendingCount ? ` (${pendingCount} pending)` : ""}
        </Link>
      </div>
      <POForm key={initial?.id ?? "blank"} initial={initial} duplicate={Boolean(initial)} payees={payees} onSubmit={createPO} />
    </AppShell>
  );
}
