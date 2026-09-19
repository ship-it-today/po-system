import Link from "next/link";
import { DEPARTMENTS } from "@/lib/po-fields";
import { PRESETS, UNITS, allowedUnits, isoDate, addUnit, reportQuery, type PresetKey, type ReportParams, type Unit } from "@/lib/reports";

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
    active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;
const inputCls = "rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white";

export default function ReportControls({
  params,
  earliest,
  requesters,
}: {
  params: ReportParams;
  earliest: Date | null;
  requesters: { id: string; label: string }[];
}) {
  const allowed = allowedUnits(params.from, params.to);
  const presets = (Object.keys(PRESETS) as PresetKey[]).filter((k) => k !== "custom");
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const toInclusive = addUnit(params.to, "day", -1);

  return (
    <div className="mb-6 space-y-3">
      {/* Row 1: date range presets */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {presets.map((k) => (
          <Link key={k} href={`/reports${reportQuery(params, { preset: k, unit: "" })}`} className={chip(params.preset === k)}>
            {PRESETS[k]}
            {k === "all" && earliest && <span className="ml-1 opacity-70">since {earliest.getFullYear()}</span>}
          </Link>
        ))}
        <details className="relative">
          <summary className={`${chip(params.preset === "custom")} cursor-pointer list-none`}>Custom…</summary>
          <form method="get" action="/reports" className="absolute left-0 z-20 mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <input type="hidden" name="preset" value="custom" />
            {params.department && <input type="hidden" name="department" value={params.department} />}
            {params.requester && <input type="hidden" name="requester" value={params.requester} />}
            {params.compare && <input type="hidden" name="compare" value="1" />}
            <label className="text-xs text-slate-600">
              From
              <input name="from" type="date" required defaultValue={isoDate(params.from)} className={`${inputCls} block`} />
            </label>
            <label className="text-xs text-slate-600">
              To
              <input name="to" type="date" required defaultValue={isoDate(toInclusive)} className={`${inputCls} block`} />
            </label>
            <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Apply</button>
          </form>
        </details>
      </div>

      {/* Row 2: what the range resolved to, group-by, compare, dimension filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-slate-600">
          {fmt(params.from)} – {fmt(toInclusive)}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="text-slate-500 whitespace-nowrap">Group by</span>
          <span className="inline-flex rounded-md border border-slate-300 bg-white overflow-hidden">
            {(Object.keys(UNITS) as Unit[]).map((u) => {
              const ok = allowed.includes(u);
              const active = params.unit === u;
              const cls = `px-2.5 py-1 text-xs ${active ? "bg-slate-900 text-white" : ok ? "text-slate-700 hover:bg-slate-50" : "text-slate-300 cursor-not-allowed"}`;
              return ok ? (
                <Link key={u} href={`/reports${reportQuery(params, { unit: u })}`} className={cls}>
                  {UNITS[u]}
                </Link>
              ) : (
                <span key={u} className={cls} title="Not useful for this range">
                  {UNITS[u]}
                </span>
              );
            })}
          </span>
          {params.unitAuto && <span className="text-xs text-slate-400">auto</span>}
        </span>

        <Link
          href={`/reports${reportQuery(params, { compare: params.compare ? "" : "1" })}`}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
            params.compare ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className={`inline-block h-3 w-3 rounded-sm border ${params.compare ? "bg-white border-white" : "border-slate-400"}`} />
          Compare to previous period
        </Link>

        <form method="get" action="/reports" className="flex w-full items-center gap-2 sm:w-auto">
          <input type="hidden" name="preset" value={params.preset} />
          {params.preset === "custom" && (
            <>
              <input type="hidden" name="from" value={isoDate(params.from)} />
              <input type="hidden" name="to" value={isoDate(toInclusive)} />
            </>
          )}
          {!params.unitAuto && <input type="hidden" name="unit" value={params.unit} />}
          {params.compare && <input type="hidden" name="compare" value="1" />}
          <select name="department" defaultValue={params.department} className={`${inputCls} min-w-0 flex-1 sm:flex-none`} aria-label="Department">
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select name="requester" defaultValue={params.requester} className={`${inputCls} min-w-0 flex-1 sm:flex-none`} aria-label="Requester">
            <option value="">All requesters</option>
            {requesters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50">Apply</button>
        </form>
      </div>
    </div>
  );
}
