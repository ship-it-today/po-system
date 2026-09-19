import Link from "next/link";
import { DEPARTMENTS } from "@/lib/po-fields";
import type { ListParams } from "@/lib/po-query";

const inputCls = "rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white";

export default function POFilters({
  basePath,
  params,
  requesters,
  showStatus = true,
}: {
  basePath: string;
  params: ListParams;
  /** When provided, shows a Requester dropdown (approver/admin views). */
  requesters?: { id: string; label: string }[];
  showStatus?: boolean;
}) {
  const active = Boolean(params.q || params.status || params.department || params.requester || params.from || params.to);

  return (
    <form method="get" action={basePath} className="mb-4 flex flex-wrap items-end gap-2">
      {/* keep sort across filter changes */}
      <input type="hidden" name="sort" value={params.sort} />
      <input type="hidden" name="dir" value={params.dir} />

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Search
        <input
          name="q"
          defaultValue={params.q}
          placeholder="PO #, payee, project, purpose"
          className={`${inputCls} w-56`}
        />
      </label>

      {showStatus && (
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Status
          <select name="status" defaultValue={params.status} className={inputCls}>
            <option value="">Any</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Department
        <select name="department" defaultValue={params.department} className={inputCls}>
          <option value="">Any</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>

      {requesters && (
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Requester
          <select name="requester" defaultValue={params.requester} className={inputCls}>
            <option value="">Anyone</option>
            {requesters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        From
        <input name="from" type="date" defaultValue={params.from} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        To
        <input name="to" type="date" defaultValue={params.to} className={inputCls} />
      </label>

      <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
        Apply
      </button>
      {active && (
        <Link href={basePath} className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-900">
          Clear
        </Link>
      )}
    </form>
  );
}
