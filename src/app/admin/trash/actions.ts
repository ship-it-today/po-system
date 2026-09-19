"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

import { TRASH_DAYS } from "@/lib/trash";

/** Collects the selected PO ids from a form (checkbox list or single hidden input). */
function ids(formData: FormData): string[] {
  const all = [...formData.getAll("ids"), formData.get("id")]
    .map((v) => String(v ?? "").trim())
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  return [...new Set(all)];
}

/** Where to send the admin afterwards; only same-site paths are allowed. */
function back(formData: FormData, fallback: string, params: Record<string, string>): never {
  const raw = String(formData.get("return_to") ?? "");
  const path = raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${new URLSearchParams(params).toString()}`);
}

function refresh() {
  for (const p of ["/", "/approvals", "/history", "/reports", "/admin/trash", "/admin/budgets"]) revalidatePath(p);
}

/** Soft-delete: the PO disappears from every list and report but can be restored for 90 days. */
export async function trashPOs(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const list = ids(formData);
  if (list.length === 0) back(formData, "/approvals", { error: "Select at least one PO." });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", list)
    .is("deleted_at", null)
    .select("id");
  if (error) back(formData, "/approvals", { error: error.message });

  for (const row of data ?? []) await logActivity(supabase, row.id, admin.id, "trashed");
  refresh();
  const n = data?.length ?? 0;
  back(formData, "/approvals", { saved: `${n} PO${n === 1 ? "" : "s"} moved to the Trash.` });
}

/** Undo: brings a trashed PO back exactly as it was. */
export async function restorePOs(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const list = ids(formData);
  if (list.length === 0) back(formData, "/admin/trash", { error: "Select at least one PO." });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ deleted_at: null })
    .in("id", list)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) back(formData, "/admin/trash", { error: error.message });

  for (const row of data ?? []) await logActivity(supabase, row.id, admin.id, "restored");
  refresh();
  const n = data?.length ?? 0;
  back(formData, "/admin/trash", { saved: `${n} PO${n === 1 ? "" : "s"} restored.` });
}

/** Permanent delete of trashed POs (line items, activity and the receipt file go with them). */
export async function purgePOs(formData: FormData) {
  await requireRole(["admin"]);
  const list = ids(formData);
  if (list.length === 0) back(formData, "/admin/trash", { error: "Select at least one PO." });

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("purchase_orders")
    .select("id, receipt_path")
    .in("id", list)
    .not("deleted_at", "is", null);
  const targets = rows ?? [];
  if (targets.length === 0) back(formData, "/admin/trash", { error: "Nothing to delete — only POs in the Trash can be deleted permanently." });

  const { error } = await supabase.from("purchase_orders").delete().in("id", targets.map((r) => r.id));
  if (error) back(formData, "/admin/trash", { error: error.message });

  const files = targets.map((r) => r.receipt_path).filter((p): p is string => Boolean(p));
  if (files.length) await supabase.storage.from("receipts").remove(files);

  refresh();
  back(formData, "/admin/trash", { saved: `${targets.length} PO${targets.length === 1 ? "" : "s"} deleted permanently.` });
}

/** Empties everything that has been in the Trash for 90+ days. Called on every Trash page load. */
export async function purgeExpired(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purge_trash", { days: TRASH_DAYS });
  if (error) {
    console.error("purge_trash failed", error.message);
    return 0;
  }
  return Number(data ?? 0);
}
