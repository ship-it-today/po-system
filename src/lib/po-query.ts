import type { SupabaseClient } from "@supabase/supabase-js";
import { DEPARTMENTS } from "@/lib/po-fields";

export const PAGE_SIZE = 25;

export const SORT_COLUMNS = {
  po_number: "PO #",
  pay_to: "Pay To",
  department: "Department",
  total: "Total",
  status: "Status",
  created_at: "Submitted",
} as const;
export type SortKey = keyof typeof SORT_COLUMNS;

export type ListParams = {
  q: string;
  status: "" | "pending" | "approved" | "denied";
  department: string;
  requester: string; // profile id
  from: string; // YYYY-MM-DD
  to: string;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseListParams(sp: RawSearchParams, defaults: Partial<ListParams> = {}): ListParams {
  const status = first(sp.status);
  // "sortdir" (mobile select) = "column:asc|desc"; falls back to separate sort/dir params.
  const [sdSort, sdDir] = first(sp.sortdir).split(":");
  const sort = (sdSort || first(sp.sort)) as SortKey;
  const dir = sdDir || first(sp.dir);
  const page = parseInt(first(sp.page), 10);
  return {
    q: first(sp.q).trim().slice(0, 100),
    status: (["pending", "approved", "denied"].includes(status) ? status : defaults.status ?? "") as ListParams["status"],
    department: (DEPARTMENTS as readonly string[]).includes(first(sp.department)) ? first(sp.department) : "",
    requester: first(sp.requester),
    from: /^\d{4}-\d{2}-\d{2}$/.test(first(sp.from)) ? first(sp.from) : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(first(sp.to)) ? first(sp.to) : "",
    sort: sort in SORT_COLUMNS ? sort : defaults.sort ?? "created_at",
    dir: dir === "asc" || dir === "desc" ? dir : defaults.dir ?? "desc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Builds the URL query string for a set of params (omits defaults / empties). */
export function toQuery(p: Partial<ListParams>): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.status) sp.set("status", p.status);
  if (p.department) sp.set("department", p.department);
  if (p.requester) sp.set("requester", p.requester);
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.sort) sp.set("sort", p.sort);
  if (p.dir) sp.set("dir", p.dir);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Runs the list query. `scope` narrows to one requester (My POs) or all.
 * Returns the page of rows plus the total count for pagination.
 */
export async function queryPOs(
  supabase: SupabaseClient,
  p: ListParams,
  scope: { requesterId?: string; trashed?: boolean } = {}
) {
  let q = supabase
    .from("purchase_orders")
    .select("*, requester:profiles!purchase_orders_requester_id_fkey(id,email,full_name)", { count: "exact" });

  // Trashed POs live only on the Trash page.
  q = scope.trashed ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);

  if (scope.requesterId) q = q.eq("requester_id", scope.requesterId);
  else if (p.requester) q = q.eq("requester_id", p.requester);

  if (p.status) q = q.eq("status", p.status);
  if (p.department) q = q.eq("department", p.department);
  if (p.from) q = q.gte("created_at", `${p.from}T00:00:00`);
  if (p.to) q = q.lte("created_at", `${p.to}T23:59:59.999`);

  if (p.q) {
    const term = p.q.replace(/[%,()]/g, " ").trim();
    const like = `%${term}%`;
    const parts = [`pay_to.ilike.${like}`, `project_name.ilike.${like}`, `purpose.ilike.${like}`];
    const asNumber = parseInt(term.replace(/^po-?/i, ""), 10);
    if (Number.isFinite(asNumber)) parts.push(`po_number.eq.${asNumber}`);
    q = q.or(parts.join(","));
  }

  q = q.order(p.sort, { ascending: p.dir === "asc" });
  if (p.sort !== "created_at") q = q.order("created_at", { ascending: false });

  const fromIdx = (p.page - 1) * PAGE_SIZE;
  q = q.range(fromIdx, fromIdx + PAGE_SIZE - 1);

  const { data, count, error } = await q;
  return { rows: data ?? [], total: count ?? 0, error };
}
