"use client";

import { useState } from "react";
import Link from "next/link";
import AutoSubmitForm from "./AutoSubmitForm";
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
  const activeCount = [params.status, params.department, params.requester, params.from, params.to].filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <AutoSubmitForm action={basePath} className="mb-4 data-[pending]:opacity-70">

      <div className="flex items-end gap-2">
        <label className="flex flex-1 md:flex-none flex-col gap-1 text-xs text-slate-600">
          Search
          <input
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder="PO #, payee, project, purpose"
            className={`${inputCls} w-full md:w-56`}
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`${inputCls} md:hidden inline-flex items-center gap-1.5 ${open ? "border-slate-900" : ""}`}
        >
          Filters
          {activeCount > 0 && <span className="rounded-full bg-slate-900 px-1.5 text-[11px] text-white">{activeCount}</span>}
        </button>
      </div>

      <div className={`mt-2 ${open ? "grid grid-cols-2 gap-2" : "hidden"} md:flex md:flex-wrap md:items-end md:gap-2`}>
        {/* Sort: a select on phones (no column headers there); on desktop it just carries the header-chosen sort along. */}
        <label className="flex flex-col gap-1 text-xs text-slate-600 md:hidden">
          Sort
          <select name="sortdir" defaultValue={`${params.sort}:${params.dir}`} className={`${inputCls} w-full`}>
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="total:desc">Highest amount</option>
            <option value="total:asc">Lowest amount</option>
            <option value="po_number:desc">PO # (high to low)</option>
            <option value="po_number:asc">PO # (low to high)</option>
            <option value="pay_to:asc">Pay To (A–Z)</option>
            <option value="status:asc">Status</option>
          </select>
        </label>

      {showStatus && (
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Status
          <select name="status" defaultValue={params.status} className={`${inputCls} w-full md:w-auto`}>
            <option value="">Any</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Department
        <select name="department" defaultValue={params.department} className={`${inputCls} w-full md:w-auto`}>
          <option value="">Any</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>

      {requesters && (
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Requester
          <select name="requester" defaultValue={params.requester} className={`${inputCls} w-full md:w-auto`}>
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
        <input name="from" type="date" defaultValue={params.from} className={`${inputCls} w-full md:w-auto`} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        To
        <input name="to" type="date" defaultValue={params.to} className={`${inputCls} w-full md:w-auto`} />
      </label>

      {active && (
        <Link href={basePath} className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-900">
          Clear
        </Link>
      )}
      </div>
    </AutoSubmitForm>
  );
}
