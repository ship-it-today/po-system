import type { POStatus } from "@/lib/types";

/* ---------- Date range presets (all relative to today) ---------- */

export const PRESETS = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  last_quarter: "Last quarter",
  ytd: "Year to date",
  last_12m: "Last 12 months",
  last_year: "Last year",
  all: "All time",
  custom: "Custom",
} as const;
export type PresetKey = keyof typeof PRESETS;

export type Unit = "day" | "week" | "month" | "quarter" | "year";
export const UNITS: Record<Unit, string> = { day: "Day", week: "Week", month: "Month", quarter: "Quarter", year: "Year" };

export type ReportParams = {
  preset: PresetKey;
  from: Date; // inclusive
  to: Date; // exclusive
  unit: Unit;
  unitAuto: boolean;
  compare: boolean;
  department: string;
  requester: string;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function bucketStart(d: Date, unit: Unit): Date {
  const x = startOfDay(d);
  if (unit === "week") x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  else if (unit === "month") x.setDate(1);
  else if (unit === "quarter") x.setMonth(Math.floor(x.getMonth() / 3) * 3, 1);
  else if (unit === "year") x.setMonth(0, 1);
  return x;
}

export function addUnit(d: Date, unit: Unit, n: number): Date {
  const x = new Date(d);
  if (unit === "day") x.setDate(x.getDate() + n);
  else if (unit === "week") x.setDate(x.getDate() + 7 * n);
  else if (unit === "month") x.setMonth(x.getMonth() + n);
  else if (unit === "quarter") x.setMonth(x.getMonth() + 3 * n);
  else x.setFullYear(x.getFullYear() + n);
  return x;
}

/** Resolve a preset to [from, to). `earliest` = first PO date, used by "All time". */
export function presetRange(preset: PresetKey, now: Date, earliest: Date | null): { from: Date; to: Date } {
  const today = startOfDay(now);
  const tomorrow = addUnit(today, "day", 1);
  const m0 = bucketStart(today, "month");
  const q0 = bucketStart(today, "quarter");
  const y0 = bucketStart(today, "year");
  switch (preset) {
    case "this_month":
      return { from: m0, to: addUnit(m0, "month", 1) };
    case "last_month":
      return { from: addUnit(m0, "month", -1), to: m0 };
    case "this_quarter":
      return { from: q0, to: addUnit(q0, "quarter", 1) };
    case "last_quarter":
      return { from: addUnit(q0, "quarter", -1), to: q0 };
    case "ytd":
      return { from: y0, to: tomorrow };
    case "last_12m":
      return { from: addUnit(m0, "month", -11), to: addUnit(m0, "month", 1) };
    case "last_year":
      return { from: addUnit(y0, "year", -1), to: y0 };
    case "all":
    default: {
      const from = earliest ? bucketStart(earliest, "month") : m0;
      return { from, to: tomorrow };
    }
  }
}

/** Pick a grouping that yields a readable number of bars (~4–30). */
export function autoUnit(from: Date, to: Date): Unit {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  if (days <= 800) return "month";
  if (days <= 3000) return "quarter";
  return "year";
}

/** Units that make sense for this span (2..60 buckets). */
export function allowedUnits(from: Date, to: Date): Unit[] {
  const days = Math.max(1, (to.getTime() - from.getTime()) / 86_400_000);
  const approx: Record<Unit, number> = { day: days, week: days / 7, month: days / 30.4, quarter: days / 91.3, year: days / 365 };
  return (Object.keys(approx) as Unit[]).filter((u) => approx[u] >= 1.5 && approx[u] <= 60 || (u === "day" && days <= 60));
}

export type RawSP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseReportParams(sp: RawSP, now: Date, earliest: Date | null, departments: readonly string[]): ReportParams {
  let preset = (first(sp.preset) in PRESETS ? first(sp.preset) : "last_12m") as PresetKey;
  let { from, to } = presetRange(preset, now, earliest);

  if (preset === "custom") {
    const f = parseISO(first(sp.from));
    const t = parseISO(first(sp.to));
    if (f && t && t >= f) {
      from = f;
      to = addUnit(t, "day", 1); // inclusive end date in the UI
    } else {
      preset = "last_12m";
      ({ from, to } = presetRange(preset, now, earliest));
    }
  }

  const allowed = allowedUnits(from, to);
  const requested = first(sp.unit) as Unit;
  const unitAuto = !(requested in UNITS && allowed.includes(requested));
  const unit = unitAuto ? autoUnit(from, to) : requested;

  const dept = first(sp.department);
  return {
    preset,
    from,
    to,
    unit,
    unitAuto,
    compare: first(sp.compare) === "1",
    department: departments.includes(dept) ? dept : "",
    requester: first(sp.requester),
  };
}

export function reportQuery(p: Partial<ReportParams> & { from?: Date; to?: Date }, overrides: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  const preset = overrides.preset ?? p.preset;
  if (preset) sp.set("preset", preset);
  if ((overrides.preset ?? p.preset) === "custom" && p.from && p.to) {
    sp.set("from", overrides.from ?? iso(p.from));
    sp.set("to", overrides.to ?? iso(addUnit(p.to, "day", -1)));
  }
  const unit = overrides.unit !== undefined ? overrides.unit : p.unitAuto ? "" : p.unit;
  if (unit) sp.set("unit", unit);
  const compare = overrides.compare !== undefined ? overrides.compare : p.compare ? "1" : "";
  if (compare) sp.set("compare", compare);
  const dept = overrides.department !== undefined ? overrides.department : p.department;
  if (dept) sp.set("department", dept);
  const req = overrides.requester !== undefined ? overrides.requester : p.requester;
  if (req) sp.set("requester", req);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const isoDate = iso;

/* ---------- Buckets & aggregation ---------- */

export type Bucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  approved: number;
  denied: number;
  pending: number;
  approvedCount: number;
  deniedCount: number;
  pendingCount: number;
};

function label(d: Date, unit: Unit, span: number): string {
  if (unit === "day") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (unit === "week") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (unit === "month") return d.toLocaleDateString("en-US", span > 12 ? { month: "short", year: "2-digit" } : { month: "short" });
  if (unit === "quarter") return `Q${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`;
  return String(d.getFullYear());
}

export function makeBuckets(from: Date, to: Date, unit: Unit): Bucket[] {
  const out: Bucket[] = [];
  let cursor = bucketStart(from, unit);
  const count = Math.ceil((to.getTime() - cursor.getTime()) / 86_400_000);
  while (cursor < to && out.length < 400) {
    const end = addUnit(cursor, unit, 1);
    out.push({
      key: cursor.toISOString(),
      label: label(cursor, unit, unit === "month" ? count / 30 : count),
      start: cursor,
      end,
      approved: 0,
      denied: 0,
      pending: 0,
      approvedCount: 0,
      deniedCount: 0,
      pendingCount: 0,
    });
    cursor = end;
  }
  return out;
}

export type ReportRow = {
  status: POStatus;
  total: number;
  created_at: string;
  department: string;
  pay_to: string;
  payment_method: string;
  requester_id: string;
};

export type Totals = { approved: number; denied: number; pending: number; approvedCount: number; deniedCount: number; pendingCount: number };

export function aggregate(rows: ReportRow[], buckets: Bucket[]) {
  const byDept = new Map<string, { amount: number; count: number }>();
  const byPayee = new Map<string, { amount: number; count: number }>();
  const byMethod = new Map<string, { amount: number; count: number }>();
  const totals: Totals = { approved: 0, denied: 0, pending: 0, approvedCount: 0, deniedCount: 0, pendingCount: 0 };

  let bi = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    while (bi < buckets.length && t >= buckets[bi].end.getTime()) bi++;
    const b = buckets[bi];
    if (!b || t < b.start.getTime()) continue;
    const amt = Number(r.total) || 0;
    b[r.status] += amt;
    b[`${r.status}Count`] += 1;
    totals[r.status] += amt;
    totals[`${r.status}Count`] += 1;

    if (r.status === "approved") {
      const bump = (m: Map<string, { amount: number; count: number }>, k: string) => {
        const cur = m.get(k) ?? { amount: 0, count: 0 };
        cur.amount += amt;
        cur.count += 1;
        m.set(k, cur);
      };
      bump(byDept, r.department || "—");
      bump(byPayee, r.pay_to || "—");
      bump(byMethod, r.payment_method);
    }
  }
  const sortDesc = (m: Map<string, { amount: number; count: number }>) =>
    [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount);
  return { totals, byDept: sortDesc(byDept), byPayee: sortDesc(byPayee), byMethod: sortDesc(byMethod) };
}

/** Totals only, for the comparison period. */
export function sumTotals(rows: ReportRow[]): Totals {
  const t: Totals = { approved: 0, denied: 0, pending: 0, approvedCount: 0, deniedCount: 0, pendingCount: 0 };
  for (const r of rows) {
    t[r.status] += Number(r.total) || 0;
    t[`${r.status}Count`] += 1;
  }
  return t;
}
