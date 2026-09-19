import type { POStatus } from "@/lib/types";

export const PERIODS = {
  weekly: { label: "Weekly", sub: "last 12 weeks", buckets: 12, unit: "week" },
  monthly: { label: "Monthly", sub: "last 12 months", buckets: 12, unit: "month" },
  quarterly: { label: "Quarterly", sub: "last 8 quarters", buckets: 8, unit: "quarter" },
  yearly: { label: "Yearly", sub: "last 3 years", buckets: 3, unit: "year" },
  "5y": { label: "5 years", sub: "last 5 years", buckets: 5, unit: "year" },
  "10y": { label: "10 years", sub: "last 10 years", buckets: 10, unit: "year" },
} as const;
export type PeriodKey = keyof typeof PERIODS;
type Unit = (typeof PERIODS)[PeriodKey]["unit"];

export function parsePeriod(v: string | string[] | undefined): PeriodKey {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s in PERIODS ? (s as PeriodKey) : "monthly";
}

/** Start of the bucket containing `d`, in local time. */
function bucketStart(d: Date, unit: Unit): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (unit === "week") {
    const day = (x.getDay() + 6) % 7; // Monday = 0
    x.setDate(x.getDate() - day);
  } else if (unit === "month") {
    x.setDate(1);
  } else if (unit === "quarter") {
    x.setMonth(Math.floor(x.getMonth() / 3) * 3, 1);
  } else {
    x.setMonth(0, 1);
  }
  return x;
}

function addUnit(d: Date, unit: Unit, n: number): Date {
  const x = new Date(d);
  if (unit === "week") x.setDate(x.getDate() + 7 * n);
  else if (unit === "month") x.setMonth(x.getMonth() + n);
  else if (unit === "quarter") x.setMonth(x.getMonth() + 3 * n);
  else x.setFullYear(x.getFullYear() + n);
  return x;
}

function label(d: Date, unit: Unit): string {
  if (unit === "week") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (unit === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  if (unit === "quarter") return `Q${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`;
  return String(d.getFullYear());
}

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

export function makeBuckets(period: PeriodKey, now = new Date()): Bucket[] {
  const { buckets, unit } = PERIODS[period];
  const latest = bucketStart(now, unit);
  const out: Bucket[] = [];
  for (let i = buckets - 1; i >= 0; i--) {
    const start = addUnit(latest, unit, -i);
    const end = addUnit(start, unit, 1);
    out.push({
      key: start.toISOString(),
      label: label(start, unit),
      start,
      end,
      approved: 0,
      denied: 0,
      pending: 0,
      approvedCount: 0,
      deniedCount: 0,
      pendingCount: 0,
    });
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
};

export function aggregate(rows: ReportRow[], buckets: Bucket[]) {
  const first = buckets[0].start.getTime();
  const byDept = new Map<string, { amount: number; count: number }>();
  const byPayee = new Map<string, { amount: number; count: number }>();
  const byMethod = new Map<string, { amount: number; count: number }>();
  const totals = { approved: 0, denied: 0, pending: 0, approvedCount: 0, deniedCount: 0, pendingCount: 0 };

  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (t < first) continue;
    const b = buckets.find((bk) => t >= bk.start.getTime() && t < bk.end.getTime());
    if (!b) continue;
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
