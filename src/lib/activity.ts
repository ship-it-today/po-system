import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityKind } from "@/lib/types";

/** Appends an entry to a PO's activity timeline. Errors are logged, never thrown. */
export async function logActivity(
  supabase: SupabaseClient,
  po_id: string,
  author_id: string,
  kind: ActivityKind,
  body: string | null = null
) {
  const { error } = await supabase.from("po_activity").insert({ po_id, author_id, kind, body });
  if (error) console.error("activity log failed", error.message);
}
