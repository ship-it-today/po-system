import type { POStatus } from "@/lib/types";

const styles: Record<POStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  denied: "bg-red-50 text-red-800 border-red-200",
};

export default function StatusBadge({ status }: { status: POStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
