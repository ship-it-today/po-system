import Link from "next/link";
import AppShell from "@/components/AppShell";
import POForm from "@/components/POForm";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPO } from "./po/actions";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireProfile();
  const { error } = await searchParams;
  const supabase = await createClient();

  const { count: pendingCount } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", profile.id)
    .eq("status", "pending");

  return (
    <AppShell profile={profile}>
      {error === "forbidden" && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          You don&apos;t have access to that page.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold">New purchase order</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Fill out the form below and submit it for approval.
          </p>
        </div>
        <Link href="/history" className="text-sm text-slate-700 underline hover:text-slate-900">
          View my PO history{pendingCount ? ` (${pendingCount} pending)` : ""}
        </Link>
      </div>
      <POForm onSubmit={createPO} />
    </AppShell>
  );
}
