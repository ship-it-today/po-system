import Link from "next/link";
import AppShell from "@/components/AppShell";
import BudgetMeter from "@/components/BudgetMeter";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEPARTMENTS } from "@/lib/po-fields";
import { formatMoney } from "@/lib/types";
import { saveBudgets } from "./actions";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string; error?: string }>;
}) {
  const admin = await requireRole(["admin"]);
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : thisYear;
  const supabase = await createClient();

  const [{ data: budgets }, { data: spend }] = await Promise.all([
    supabase.from("department_budgets").select("*").eq("fiscal_year", year),
    supabase
      .from("purchase_orders")
      .select("department, status, total")
      .gte("created_at", `${year}-01-01T00:00:00`)
      .lt("created_at", `${year + 1}-01-01T00:00:00`)
      .is("deleted_at", null)
      .in("status", ["approved", "pending"]),
  ]);
  const budgetOf = new Map((budgets ?? []).map((b) => [b.department, Number(b.amount)]));
  const used = new Map<string, { approved: number; pending: number }>();
  for (const r of spend ?? []) {
    const cur = used.get(r.department) ?? { approved: 0, pending: 0 };
    if (r.status === "approved") cur.approved += Number(r.total) || 0;
    else cur.pending += Number(r.total) || 0;
    used.set(r.department, cur);
  }
  const totalBudget = [...budgetOf.values()].reduce((a, b) => a + b, 0);
  const totalUsed = [...used.values()].reduce((a, b) => a + b.approved, 0);

  return (
    <AppShell profile={admin}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Department Budgets</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Annual budgets by calendar year. Approvers see used-vs-budget on every PO; Reports shows the full picture.
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/admin/budgets?year=${year - 1}`} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 hover:bg-slate-50">←</Link>
          <span className="px-2 font-medium">{year}</span>
          <Link href={`/admin/budgets?year=${year + 1}`} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 hover:bg-slate-50">→</Link>
        </div>
      </div>

      {sp.error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{sp.error}</p>}
      {sp.saved && <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">Budgets saved.</p>}

      {totalBudget > 0 && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
          <BudgetMeter department="All departments" year={year} used={totalUsed} budget={totalBudget} />
        </div>
      )}

      <form action={saveBudgets} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <input type="hidden" name="year" value={year} />
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Department</th>
              <th className="px-4 py-2.5 w-32 md:w-44">Budget {year}</th>
              <th className="hidden md:table-cell px-4 py-2.5 text-right">Approved</th>
              <th className="hidden md:table-cell px-4 py-2.5 text-right">Pending</th>
              <th className="px-4 py-2.5 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DEPARTMENTS.map((d) => {
              const b = budgetOf.get(d);
              const u = used.get(d) ?? { approved: 0, pending: 0 };
              const remaining = b == null ? null : b - u.approved;
              return (
                <tr key={d}>
                  <td className="px-4 py-2">{d}</td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-sm text-slate-400">$</span>
                      <input
                        name={`b_${d}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={b == null ? "" : String(b)}
                        placeholder="—"
                        className="w-full rounded-md border border-slate-300 pl-6 pr-2 py-1 text-sm text-right"
                      />
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-2 text-right tabular-nums">{formatMoney(u.approved)}</td>
                  <td className="hidden md:table-cell px-4 py-2 text-right tabular-nums text-slate-500">{formatMoney(u.pending)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${remaining != null && remaining < 0 ? "text-red-700 font-medium" : ""}`}>
                    {remaining == null ? <span className="text-slate-400">—</span> : formatMoney(remaining)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-4 py-3">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Save budgets
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs text-slate-500">Leave a budget blank to not track that department. Spend counts POs by the date they were submitted.</p>
    </AppShell>
  );
}
