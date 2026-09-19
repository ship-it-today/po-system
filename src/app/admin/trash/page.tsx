import Link from "next/link";
import AppShell from "@/components/AppShell";
import BulkForm from "@/components/BulkForm";
import POFilters from "@/components/POFilters";
import POTable from "@/components/POTable";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseListParams, queryPOs, toQuery, type RawSearchParams } from "@/lib/po-query";
import { displayName, type PurchaseOrder } from "@/lib/types";
import { TRASH_DAYS } from "@/lib/trash";
import { purgeExpired, purgePOs, restorePOs } from "./actions";

export default async function TrashPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const admin = await requireRole(["admin"]);
  const raw = await searchParams;
  const { error, saved } = raw as { error?: string; saved?: string };

  // Housekeeping: anything older than the retention window goes now.
  const purged = await purgeExpired();

  const params = parseListParams(raw, { sort: "created_at", dir: "desc" });
  const supabase = await createClient();
  const [{ rows, total }, { data: people }] = await Promise.all([
    queryPOs(supabase, params, { trashed: true }),
    supabase.from("profiles").select("id, email, full_name").order("full_name"),
  ]);
  const orders = rows as PurchaseOrder[];
  const requesters = (people ?? []).map((p) => ({ id: p.id, label: displayName(p) }));
  const returnTo = `/admin/trash${toQuery(params)}`;

  return (
    <AppShell profile={admin}>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Trash</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          POs moved here are hidden from everyone and deleted automatically after {TRASH_DAYS} days. Restore them any time
          before then, or delete them now.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      {saved && (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{saved}</p>
      )}
      {purged > 0 && (
        <p className="mb-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          {purged} PO{purged === 1 ? "" : "s"} older than {TRASH_DAYS} days {purged === 1 ? "was" : "were"} deleted permanently.
        </p>
      )}

      {total > 0 || params.q || params.status || params.department || params.requester || params.from || params.to ? (
        <POFilters basePath="/admin/trash" params={params} requesters={requesters} />
      ) : null}

      <BulkForm
        returnTo={returnTo}
        actions={[
          { label: "Restore", action: restorePOs },
          {
            label: "Delete Permanently",
            action: purgePOs,
            danger: true,
            confirm: "Delete the selected POs for good? This can't be undone.",
          },
        ]}
      >
        <POTable
          orders={orders}
          total={total}
          params={params}
          basePath="/admin/trash"
          showRequester
          selectable
          trashed
          emptyText="The Trash is empty."
        />
      </BulkForm>

      {total > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          To trash more POs, select them on{" "}
          <Link href="/approvals?status=" className="underline">
            All POs
          </Link>
          . Deleting permanently also removes line items, comments and the uploaded receipt.
        </p>
      )}
    </AppShell>
  );
}
