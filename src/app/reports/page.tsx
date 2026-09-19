import Link from "next/link";
import AppShell from "@/components/AppShell";
import StackedBars from "@/components/charts/StackedBars";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS, labelFor } from "@/lib/po-fields";
import { PERIODS, aggregate, makeBuckets, parsePeriod, type ReportRow } from "@/lib/reports";
import { formatMoney } from "@/lib/types";

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
  const period = parsePeriod(sp.period);
  const buckets = makeBuckets(period);
  const supabase = await createClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select("status, total, created_at, department, pay_to, payment_method")
    .gte("created_at", buckets[0].start.toISOString())
    .order("created_at");
  const rows = (data ?? []) as ReportRow[];
  const { totals, byDept, byPayee, byMethod } = aggregate(rows, buckets);

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
            {PERIODS[period].label} view · {PERIODS[period].sub} · grouped by the date each PO was submitted
          </p>
        </div>
        <a
          href={`/reports/export?period=${period}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Download CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 border-b border-slate-200">
        {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((k) => (
          <Link
            key={k}
            href={`/reports?period=${k}`}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${
              period === k
                ? "border-slate-900 text-slate-900 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {PERIODS[k].label}
          </Link>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Approved" value={formatMoney(totals.approved)} sub={`${totals.approvedCount} POs`} accent="#1baf7a" />
        <Stat label="Denied" value={formatMoney(totals.denied)} sub={`${totals.deniedCount} POs`} accent="#eb6834" />
        <Stat label="Pending" value={formatMoney(totals.pending)} sub={`${totals.pendingCount} POs`} accent="#2a78d6" />
        <Stat
          label="Approval rate"
          value={approvalRate == null ? "—" : `${approvalRate}%`}
          sub={avgApproved == null ? "no decisions yet" : `avg approved ${formatMoney(avgApproved)}`}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 mb-6">
        <h2 className="font-semibold mb-3">Amounts by period</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No purchase orders in this range yet.</p>
        ) : (
          <StackedBars data={chartData} series={SERIES} />
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">Show as table</summary>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold mb-1">Approved by department</h2>
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
            <h2 className="font-semibold mb-1">Top payees</h2>
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
            <h2 className="font-semibold mb-1">Approved by payment method</h2>
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

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        {accent && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: accent }} />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
