import AppShell from "@/components/AppShell";
import StackedBars from "@/components/charts/StackedBars";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS, labelFor } from "@/lib/po-fields";
import {
  UNITS,
  addUnit,
  aggregate,
  makeBuckets,
  parseReportParams,
  reportQuery,
  sumTotals,
  type ReportRow,
} from "@/lib/reports";
import { DEPARTMENTS } from "@/lib/po-fields";
import ReportControls from "@/components/ReportControls";
import { displayName, formatMoney } from "@/lib/types";
import BudgetMeter from "@/components/BudgetMeter";
import Link from "next/link";

// Categorical slots 3 / 2 / 1 of the validated palette (aqua, orange, blue).
const SERIES = [
  { key: "approved", label: "Approved", color: "#1baf7a" },
  { key: "denied", label: "Denied", color: "#eb6834" },
  { key: "pending", label: "Pending", color: "#2a78d6" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole(["approver", "admin"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const now = new Date();

  const [{ data: firstRow }, { data: people }] = await Promise.all([
    supabase.from("purchase_orders").select("created_at").is("deleted_at", null).order("created_at").limit(1).maybeSingle(),
    supabase.from("profiles").select("id, email, full_name").order("full_name"),
  ]);
  const earliest = firstRow ? new Date(firstRow.created_at) : null;
  const params = parseReportParams(sp, now, earliest, DEPARTMENTS);
  const requesters = (people ?? []).map((p) => ({ id: p.id, label: displayName(p) }));

  const buckets = makeBuckets(params.from, params.to, params.unit);
  const spanMs = params.to.getTime() - params.from.getTime();
  const prevFrom = new Date(params.from.getTime() - spanMs);

  let q = supabase
    .from("purchase_orders")
    .select("status, total, created_at, department, pay_to, payment_method, requester_id")
    .gte("created_at", (params.compare ? prevFrom : params.from).toISOString())
    .lt("created_at", params.to.toISOString())
    .is("deleted_at", null)
    .order("created_at");
  if (params.department) q = q.eq("department", params.department);
  if (params.requester) q = q.eq("requester_id", params.requester);
  const { data } = await q;
  const all = (data ?? []) as ReportRow[];
  const rows = all.filter((r) => new Date(r.created_at) >= params.from);
  const prevRows = params.compare ? all.filter((r) => new Date(r.created_at) < params.from) : [];
  const { totals, byDept, byPayee, byMethod } = aggregate(rows, buckets);
  const prev = params.compare ? sumTotals(prevRows) : null;
  const delta = (cur: number, before: number | undefined) =>
    before == null ? undefined : before === 0 ? (cur === 0 ? 0 : null) : Math.round(((cur - before) / before) * 100);
  const fmtRange = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Budget vs. approved spend for the current calendar year.
  const thisYear = new Date().getFullYear();
  const [{ data: budgets }, { data: ytd }] = await Promise.all([
    supabase.from("department_budgets").select("department, amount").eq("fiscal_year", thisYear),
    supabase
      .from("purchase_orders")
      .select("department, status, total")
      .gte("created_at", `${thisYear}-01-01T00:00:00`)
      .is("deleted_at", null)
      .in("status", ["approved", "pending"]),
  ]);
  const ytdUsed = new Map<string, { approved: number; pending: number }>();
  for (const r of ytd ?? []) {
    const cur = ytdUsed.get(r.department) ?? { approved: 0, pending: 0 };
    if (r.status === "approved") cur.approved += Number(r.total) || 0;
    else cur.pending += Number(r.total) || 0;
    ytdUsed.set(r.department, cur);
  }
  const budgetRows = (budgets ?? [])
    .map((b) => ({ department: b.department, budget: Number(b.amount), ...(ytdUsed.get(b.department) ?? { approved: 0, pending: 0 }) }))
    .sort((a, b) => b.approved / Math.max(1, b.budget) - a.approved / Math.max(1, a.budget));

  const decided = totals.approvedCount + totals.deniedCount;
  const approvalRate = decided ? Math.round((totals.approvedCount / decided) * 100) : null;
  const avgApproved = totals.approvedCount ? totals.approved / totals.approvedCount : null;
  const deptMax = Math.max(1, ...byDept.map((d) => d.amount));

  const chartData = buckets.map((b) => ({
    label: b.label,
    values: { approved: b.approved, denied: b.denied, pending: b.pending },
    counts: { approved: b.approvedCount, denied: b.deniedCount, pending: b.pendingCount },
  }));

  return (
    <AppShell profile={profile}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {fmtRange(params.from)} – {fmtRange(addUnit(params.to, "day", -1))} · by {UNITS[params.unit].toLowerCase()}, based on submit date
            {params.compare && ` · vs ${fmtRange(prevFrom)} – ${fmtRange(addUnit(params.from, "day", -1))}`}
          </p>
        </div>
        <a
          href={`/reports/export${reportQuery(params)}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Download CSV
        </a>
      </div>

      <ReportControls params={params} earliest={earliest} requesters={requesters} />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Approved" value={formatMoney(totals.approved)} sub={`${totals.approvedCount} POs`} accent="#1baf7a" delta={delta(totals.approved, prev?.approved)} />
        <Stat label="Denied" value={formatMoney(totals.denied)} sub={`${totals.deniedCount} POs`} accent="#eb6834" delta={delta(totals.denied, prev?.denied)} invert />
        <Stat label="Pending" value={formatMoney(totals.pending)} sub={`${totals.pendingCount} POs`} accent="#2a78d6" />
        <Stat
          label="Approval rate"
          value={approvalRate == null ? "—" : `${approvalRate}%`}
          sub={avgApproved == null ? "no decisions yet" : `avg approved ${formatMoney(avgApproved)}`}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 mb-6">
        <h2 className="font-semibold mb-3">Amounts by Period</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No purchase orders in this range yet.</p>
        ) : (
          <StackedBars data={chartData} series={SERIES} />
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">Show as Table</summary>
          <table className="mt-2 min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1.5 pr-4">Period</th>
                <th className="py-1.5 pr-4 text-right">Approved</th>
                <th className="py-1.5 pr-4 text-right">Denied</th>
                <th className="py-1.5 pr-4 text-right">Pending</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buckets.map((b) => (
                <tr key={b.key}>
                  <td className="py-1.5 pr-4">{b.label}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {formatMoney(b.approved)} <span className="text-slate-400">({b.approvedCount})</span>
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {formatMoney(b.denied)} <span className="text-slate-400">({b.deniedCount})</span>
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {formatMoney(b.pending)} <span className="text-slate-400">({b.pendingCount})</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium">
                    {formatMoney(b.approved + b.denied + b.pending)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {budgetRows.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold">Budget vs. Spend · {thisYear}</h2>
            {profile.role === "admin" && (
              <Link href="/admin/budgets" className="text-xs text-slate-500 underline">Edit budgets</Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {budgetRows.map((b) => (
              <BudgetMeter key={b.department} department={b.department} year={thisYear} used={b.approved} budget={b.budget} pendingAmount={b.pending} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold mb-1">Approved by Department</h2>
          <p className="text-xs text-slate-500 mb-4">Approved amounts in this range</p>
          {byDept.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing approved yet.</p>
          ) : (
            <ul className="space-y-2">
              {byDept.map((d) => (
                <li key={d.name} className="text-sm" title={`${d.name}: ${formatMoney(d.amount)} across ${d.count} POs`}>
                  <div className="flex justify-between gap-2 mb-0.5">
                    <span className="truncate">{d.name}</span>
                    <span className="tabular-nums text-slate-700 shrink-0">
                      {formatMoney(d.amount)} <span className="text-slate-400">({d.count})</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-sm bg-slate-100">
                    <div className="h-2 rounded-sm" style={{ width: `${(d.amount / deptMax) * 100}%`, background: "#2a78d6" }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold mb-1">Top Payees</h2>
            <p className="text-xs text-slate-500 mb-3">By approved amount</p>
            {byPayee.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing approved yet.</p>
            ) : (
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {byPayee.slice(0, 8).map((p) => (
                    <tr key={p.name}>
                      <td className="py-1.5 pr-3">{p.name}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(p.amount)} <span className="text-slate-400">({p.count})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold mb-1">Approved by Payment Method</h2>
            {byMethod.length === 0 ? (
              <p className="text-sm text-slate-500 mt-2">Nothing approved yet.</p>
            ) : (
              <table className="min-w-full text-sm mt-2">
                <tbody className="divide-y divide-slate-100">
                  {byMethod.map((m) => (
                    <tr key={m.name}>
                      <td className="py-1.5 pr-3">{labelFor(PAYMENT_METHODS, m.name)}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(m.amount)} <span className="text-slate-400">({m.count})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  delta,
  invert,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
  /** % change vs previous period; null = previous was zero; undefined = not comparing */
  delta?: number | null;
  /** true when a decrease is good (e.g. denied) */
  invert?: boolean;
}) {
  let deltaEl: React.ReactNode = null;
  if (delta === null) deltaEl = <span className="text-xs text-slate-400">new vs prev.</span>;
  else if (delta !== undefined) {
    const good = delta === 0 ? null : invert ? delta < 0 : delta > 0;
    deltaEl = (
      <span className={`text-xs font-medium ${good == null ? "text-slate-500" : good ? "text-emerald-700" : "text-red-700"}`}>
        {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}% vs prev.
      </span>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        {accent && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: accent }} />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
        <span>{sub}</span>
        {deltaEl}
      </div>
    </div>
  );
}
