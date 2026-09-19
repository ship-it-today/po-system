import AutoSubmitForm from "./AutoSubmitForm";
import { DEPARTMENTS } from "@/lib/po-fields";
import { PRESETS, UNITS, allowedUnits, autoUnit, isoDate, addUnit, type PresetKey, type ReportParams, type Unit } from "@/lib/reports";

const selectCls = "w-full md:w-auto h-10 md:h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900";
const dateCls = "min-w-0 flex-1 md:flex-none h-10 md:h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900";

/**
 * One row of plain dropdowns; every change applies instantly.
 * Period · (custom dates) · Group by · Department · Requester · Compare
 */
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
  const auto = autoUnit(params.from, params.to);
  const toInclusive = addUnit(params.to, "day", -1);

  return (
    <AutoSubmitForm action="/reports" className="mb-6 data-[pending]:opacity-70">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <Field label="Period">
          <select name="preset" defaultValue={params.preset} className={selectCls}>
            {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
              <option key={k} value={k}>
                {k === "all" && earliest ? `All time (since ${earliest.getFullYear()})` : k === "custom" ? "Custom range…" : PRESETS[k]}
              </option>
            ))}
          </select>
        </Field>

        {params.preset === "custom" && (
          <div className="flex items-center gap-1.5">
            <input name="from" type="date" aria-label="From date" defaultValue={isoDate(params.from)} max={isoDate(toInclusive)} className={dateCls} />
            <span className="text-slate-400">–</span>
            <input name="to" type="date" aria-label="To date" defaultValue={isoDate(toInclusive)} min={isoDate(params.from)} className={dateCls} />
          </div>
        )}

        <Field label="Group by">
          <select name="unit" defaultValue={params.unitAuto ? "" : params.unit} className={selectCls}>
            <option value="">Auto ({UNITS[auto]})</option>
            {allowed.map((u: Unit) => (
              <option key={u} value={u}>
                {UNITS[u]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Department">
          <select name="department" defaultValue={params.department} className={`${selectCls} max-w-[11rem]`}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Requester">
          <select name="requester" defaultValue={params.requester} className={`${selectCls} max-w-[11rem]`}>
            <option value="">All requesters</option>
            {requesters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <label className="inline-flex h-10 md:h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 cursor-pointer select-none">
          <input type="checkbox" name="compare" value="1" defaultChecked={params.compare} className="h-4 w-4 accent-slate-900" />
          Compare to previous period
        </label>
      </div>
    </AutoSubmitForm>
  );
}

/** Visually-hidden label keeps each dropdown accessible without cluttering the row. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}
