"use client";

import { useState } from "react";
import Link from "next/link";
import AutoSubmitForm from "./AutoSubmitForm";
import { DEPARTMENTS } from "@/lib/po-fields";
import type { ListParams } from "@/lib/po-query";

const ctl = "h-10 md:h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 w-full md:w-auto";

/**
 * One tidy row of filters; every change applies instantly.
 * Search · Department · Requester · From – To · Clear
 * On phones the search stays visible and the rest folds behind a "Filters" button.
 */
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
  /** Status dropdown — turn off on pages that already have status tabs. */
  showStatus?: boolean;
}) {
  const activeCount = [showStatus && params.status, params.department, params.requester, params.from, params.to].filter(Boolean).length;
  const active = Boolean(params.q) || activeCount > 0;
  const [open, setOpen] = useState(activeCount > 0);
  // Keep the tab's status in the URL when it isn't an editable filter here.
  const carryStatus = !showStatus && params.status;

  return (
    <AutoSubmitForm action={basePath} className="mb-4 data-[pending]:opacity-70">
      {carryStatus && <input type="hidden" name="status" value={params.status} />}

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder="Search POs…"
            aria-label="Search"
            className={`${ctl} flex-1 md:w-64`}
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`${ctl} md:hidden w-auto inline-flex items-center gap-1.5 ${open ? "border-slate-900" : ""}`}
          >
            Filters
            {activeCount > 0 && <span className="rounded-full bg-slate-900 px-1.5 text-[11px] text-white">{activeCount}</span>}
          </button>
        </div>

        <div className={`${open ? "flex" : "hidden"} flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center`}>
          {/* Sort: only needed on phones (desktop has sortable column headers). */}
          <select name="sortdir" defaultValue={`${params.sort}:${params.dir}`} aria-label="Sort" className={`${ctl} md:hidden`}>
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="total:desc">Highest amount</option>
            <option value="total:asc">Lowest amount</option>
            <option value="po_number:desc">PO # (high to low)</option>
            <option value="po_number:asc">PO # (low to high)</option>
            <option value="pay_to:asc">Pay To (A–Z)</option>
            <option value="status:asc">Status</option>
          </select>

          {showStatus && (
            <select name="status" defaultValue={params.status} aria-label="Status" className={ctl}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
            </select>
          )}

          <select name="department" defaultValue={params.department} aria-label="Department" className={`${ctl} md:max-w-[11rem]`}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>

          {requesters && (
            <select name="requester" defaultValue={params.requester} aria-label="Requester" className={`${ctl} md:max-w-[11rem]`}>
              <option value="">All requesters</option>
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <input name="from" type="date" defaultValue={params.from} max={params.to || undefined} aria-label="From date" className={`${ctl} min-w-0 flex-1 md:flex-none`} />
            <span className="text-slate-400">–</span>
            <input name="to" type="date" defaultValue={params.to} min={params.from || undefined} aria-label="To date" className={`${ctl} min-w-0 flex-1 md:flex-none`} />
          </div>

          {active && (
            <Link href={carryStatus ? `${basePath}?status=${params.status}` : basePath} className="px-1 py-1.5 text-sm text-slate-500 hover:text-slate-900">
              Clear
            </Link>
          )}
        </div>
      </div>
    </AutoSubmitForm>
  );
}
