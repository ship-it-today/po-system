import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import POForm from "@/components/POForm";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseOrder } from "@/lib/types";
import { updatePO } from "../../actions";

export default async function EditPOPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select("*, line_items:po_line_items(*)")
    .eq("id", id)
    .order("position", { referencedTable: "po_line_items" })
    .single();
  if (!data) notFound();
  const po = data as PurchaseOrder;
  if (po.requester_id !== profile.id || po.status !== "pending") redirect(`/po/${id}`);

  const action = updatePO.bind(null, id);

  return (
    <AppShell profile={profile}>
      <h1 className="text-xl font-semibold mb-6">Edit PO-{po.po_number}</h1>
      <POForm initial={po} onSubmit={action} />
    </AppShell>
  );
}
