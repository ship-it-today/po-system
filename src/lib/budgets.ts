import type { SupabaseClient } from "@supabase/supabase-js";

/** Approved + pending spend for a department in a calendar year, and its budget. */
export async function departmentBudgetStatus(supabase: SupabaseClient, department: string, year: number) {
  const start = `${year}-01-01T00:00:00`;
  const end = `${year + 1}-01-01T00:00:00`;
  const [{ data: rows }, { data: b }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("status, total")
      .eq("department", department)
      .gte("created_at", start)
      .lt("created_at", end)
      .is("deleted_at", null)
      .in("status", ["approved", "pending"]),
    supabase.from("department_budgets").select("amount").eq("department", department).eq("fiscal_year", year).maybeSingle(),
  ]);
  let used = 0;
  let pending = 0;
  for (const r of rows ?? []) {
    if (r.status === "approved") used += Number(r.total) || 0;
    else pending += Number(r.total) || 0;
  }
  return { used, pending, budget: b ? Number(b.amount) : null };
}
