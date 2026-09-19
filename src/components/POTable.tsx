import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { PurchaseOrder } from "@/lib/types";
import { displayName, formatMoney } from "@/lib/types";
import { PAGE_SIZE, SORT_COLUMNS, toQuery, type ListParams, type SortKey } from "@/lib/po-query";
import { SelectAll } from "./BulkForm";
import { daysLeft } from "@/lib/trash";

export default function POTable({
  orders,
  total,
  params,
  basePath,
  showRequester = false,
  emptyText = "No purchase orders yet.",
  selectable = false,
  trashed = false,
}: {
  orders: PurchaseOrder[];
  total: number;
  params: ListParams;
  basePath: string;
  showRequester?: boolean;
  emptyText?: string;
  /** Adds a checkbox per row (name="ids"); wrap the table in <BulkForm>. */
  selectable?: boolean;
  /** Trash view: shows when it was deleted and how long until it's purged. */
  trashed?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (params.page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, params.page * PAGE_SIZE);

  const sortHref = (key: SortKey) => {
    const dir = params.sort === key && params.dir === "asc" ? "desc" : params.sort === key ? "asc" : key === "created_at" || key === "total" ? "desc" : "asc";
    return basePath + toQuery({ ...params, sort: key, dir, page: 1 });
  };
  const pageHref = (page: number) => basePath + toQuery({ ...params, page });


  return (
    <div>
      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <>
        {/* Mobile: tappable cards */}
        <ul className="md:hidden space-y-2">
          {orders.map((po) => (
            <li key={po.id} className="flex items-stretch gap-2">
              {selectable && (
                <label className="flex items-center px-1">
                  <input type="checkbox" name="ids" value={po.id} aria-label={`Select PO-${po.po_number}`} className="h-5 w-5 accent-slate-900" />
                </label>
              )}
              <Link href={`/po/${po.id}`} className="block flex-1 min-w-0 rounded-lg border border-slate-200 bg-white p-4 active:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">PO-{po.po_number} <span className="font-normal text-slate-500">· {po.pay_to}</span></div>
                    <div className="mt-0.5 text-sm text-slate-600 truncate">
                      {[po.project_name, po.department].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {showRequester && `${displayName(po.requester)} · `}
                      {new Date(po.created_at).toLocaleDateString()}
                    </div>
                    {trashed && po.deleted_at && <TrashNote deletedAt={po.deleted_at} className="mt-1 text-xs" />}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(po.total)}</div>
                    <div className="mt-1"><StatusBadge status={po.status} /></div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {/* Desktop: sortable table */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {selectable && (
                  <th className="w-8 px-3 py-2.5">
                    <SelectAll />
                  </th>
                )}
                <Th k="po_number" params={params} href={sortHref("po_number")} />
                <th className="px-4 py-2.5">Project Name</th>
                <Th k="pay_to" params={params} href={sortHref("pay_to")} />
                {showRequester && <th className="px-4 py-2.5">Requester</th>}
                <Th k="department" params={params} href={sortHref("department")} />
                <Th k="total" right params={params} href={sortHref("total")} />
                <Th k="status" params={params} href={sortHref("status")} />
                <Th k="created_at" params={params} href={sortHref("created_at")} />
                {trashed && <th className="px-4 py-2.5">Deleted</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50">
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input type="checkbox" name="ids" value={po.id} aria-label={`Select PO-${po.po_number}`} className="h-4 w-4 accent-slate-900" />
                    </td>
                  )}
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/po/${po.id}`} className="text-slate-900 hover:underline">
                      PO-{po.po_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{po.project_name || <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-slate-600">{po.pay_to}</td>
                  {showRequester && <td className="px-4 py-2.5">{displayName(po.requester)}</td>}
                  <td className="px-4 py-2.5 text-slate-600">{po.department ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(po.total)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(po.created_at).toLocaleDateString()}</td>
                  {trashed && (
                    <td className="px-4 py-2.5 text-slate-500">
                      {po.deleted_at ? <TrashNote deletedAt={po.deleted_at} /> : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          {total === 0 ? "No results" : `Showing ${start}–${end} of ${total}`}
        </span>
        {pages > 1 && (
          <nav className="flex items-center gap-1">
            <PageLink href={pageHref(params.page - 1)} disabled={params.page <= 1}>
              ← Prev
            </PageLink>
            {pageNumbers(params.page, pages).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} className="px-1">
                  …
                </span>
              ) : (
                <PageLink key={n} href={pageHref(n)} current={n === params.page}>
                  {n}
                </PageLink>
              )
            )}
            <PageLink href={pageHref(params.page + 1)} disabled={params.page >= pages}>
              Next →
            </PageLink>
          </nav>
        )}
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  current,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  children: React.ReactNode;
}) {
  const cls = `inline-flex items-center rounded-md px-3 py-2 md:py-1 min-h-10 md:min-h-0 text-sm ${
    current ? "bg-slate-900 text-white" : disabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-100"
  }`;
  if (disabled || current) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

function pageNumbers(current: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, current - 1, current, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push(null);
    out.push(nums[i]);
  }
  return out;
}

function Th({ k, right, params, href }: { k: SortKey; right?: boolean; params: ListParams; href: string }) {
  const activeSort = params.sort === k;
  return (
    <th className={`px-4 py-2.5 ${right ? "text-right" : ""}`}>
      <Link href={href} className={`inline-flex items-center gap-1 hover:text-slate-900 ${activeSort ? "text-slate-900" : ""}`}>
        {SORT_COLUMNS[k]}
        <span className="text-[10px]">{activeSort ? (params.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </Link>
    </th>
  );
}

function TrashNote({ deletedAt, className = "" }: { deletedAt: string; className?: string }) {
  const left = daysLeft(deletedAt);
  return (
    <span className={`${className} ${left <= 7 ? "text-red-600" : ""}`}>
      {new Date(deletedAt).toLocaleDateString()} · {left === 0 ? "purges today" : `${left} day${left === 1 ? "" : "s"} left`}
    </span>
  );
}
