import { formatMoney } from "@/lib/types";

/** One-hue meter: used vs. budget for a department in a calendar year. */
export default function BudgetMeter({
  department,
  year,
  used,
  budget,
  pendingAmount = 0,
  compact = false,
}: {
  department: string;
  year: number;
  used: number;
  budget: number | null;
  pendingAmount?: number;
  compact?: boolean;
}) {
  if (budget == null) {
    return compact ? null : (
      <p className="text-xs text-slate-500">No {year} budget set for {department}.</p>
    );
  }
  const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 100;
  const pendPct = budget > 0 ? Math.min(100 - pct, (pendingAmount / budget) * 100) : 0;
  const over = used > budget;
  const remaining = budget - used;

  return (
    <div className="text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-slate-700">
          {department} · {year}
        </span>
        <span className={`tabular-nums ${over ? "text-red-700 font-medium" : "text-slate-700"}`}>
          {formatMoney(used)} of {formatMoney(budget)}
        </span>
      </div>
      <div className="mt-1 h-2.5 w-full rounded-sm bg-slate-100 overflow-hidden flex" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={budget}>
        <div className="h-full" style={{ width: `${pct}%`, background: over ? "#d03b3b" : "#2a78d6" }} />
        {pendPct > 0 && <div className="h-full" style={{ width: `${pendPct}%`, background: "#93c5fd" }} title="Pending" />}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {over ? `Over budget by ${formatMoney(-remaining)}` : `${formatMoney(remaining)} remaining`}
        {pendingAmount > 0 && ` · ${formatMoney(pendingAmount)} pending`}
      </div>
    </div>
  );
}
