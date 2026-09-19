import type { POStatus } from "@/lib/types";

export default function StatusStepper({ status, decidedAt }: { status: POStatus; decidedAt: string | null }) {
  const steps = [
    { label: "Submitted", done: true },
    { label: "Under review", done: true, active: status === "pending" },
    {
      label: status === "approved" ? "Approved" : status === "denied" ? "Denied" : "Decision",
      done: status !== "pending",
      tone: status === "approved" ? "good" : status === "denied" ? "bad" : "none",
    },
  ] as const;

  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Status">
      {steps.map((s, i) => {
        const color =
          "tone" in s && s.tone === "good"
            ? "bg-emerald-600 border-emerald-600 text-white"
            : "tone" in s && s.tone === "bad"
              ? "bg-red-600 border-red-600 text-white"
              : s.done && !("active" in s && s.active)
                ? "bg-slate-900 border-slate-900 text-white"
                : "active" in s && s.active
                  ? "bg-white border-slate-900 text-slate-900"
                  : "bg-white border-slate-300 text-slate-400";
        return (
          <li key={s.label} className="flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${color}`}>
              {s.done && !("active" in s && s.active) ? "✓" : i + 1}
            </span>
            <span className={s.done ? "text-slate-800" : "text-slate-400"}>
              {s.label}
              {i === 2 && decidedAt && <span className="text-slate-400"> · {new Date(decidedAt).toLocaleDateString()}</span>}
            </span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}
