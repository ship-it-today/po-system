"use client";

import { useRef, useState, type ReactNode } from "react";

export type BulkAction = {
  label: string;
  /** Server action; receives the checked `ids` plus `return_to`. */
  action: (formData: FormData) => void | Promise<void>;
  /** Asks "Are you sure?" inline before running. */
  confirm?: string;
  danger?: boolean;
};

/**
 * Wraps a list that renders `<input type="checkbox" name="ids">` rows.
 * Shows a sticky bar with the selection count and the bulk actions.
 */
export default function BulkForm({
  actions,
  returnTo,
  children,
  noun = "PO",
}: {
  actions: BulkAction[];
  returnTo: string;
  children: ReactNode;
  noun?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [arming, setArming] = useState<number | null>(null);

  const recount = () => {
    const boxes = ref.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? [];
    let n = 0;
    boxes.forEach((b) => b.checked && n++);
    setCount(n);
    if (n === 0) setArming(null);
  };

  const setAll = (checked: boolean) => {
    ref.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((b) => (b.checked = checked));
    recount();
  };

  return (
    <form ref={ref} onChange={recount} className="relative">
      <input type="hidden" name="return_to" value={returnTo} />
      {children}

      {count > 0 && (
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-4 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white p-2.5 shadow-lg">
          <span className="px-1 text-sm font-medium">
            {count} {noun}
            {count === 1 ? "" : "s"} selected
          </span>
          <button type="button" onClick={() => setAll(false)} className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-900">
            Clear
          </button>
          <span className="flex-1" />
          {actions.map((a, i) =>
            arming === i ? (
              <span key={a.label} className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-700">{a.confirm}</span>
                <button
                  type="submit"
                  formAction={a.action}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 min-h-10"
                >
                  Yes, {a.label.toLowerCase()}
                </button>
                <button type="button" onClick={() => setArming(null)} className="px-2 py-1.5 text-sm text-slate-500">
                  Cancel
                </button>
              </span>
            ) : (
              <button
                key={a.label}
                type={a.confirm ? "button" : "submit"}
                formAction={a.confirm ? undefined : a.action}
                onClick={a.confirm ? () => setArming(i) : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium min-h-10 ${
                  a.danger
                    ? "border border-red-300 text-red-700 hover:bg-red-50"
                    : "border border-slate-300 text-slate-800 hover:bg-slate-50"
                }`}
              >
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </form>
  );
}

/** Header checkbox: selects/deselects every row in the enclosing form. */
export function SelectAll({ label = "Select all" }: { label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 accent-slate-900"
      onChange={(e) => {
        const form = e.currentTarget.form;
        const on = e.currentTarget.checked;
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((b) => (b.checked = on));
        // This change event then bubbles to BulkForm, which recounts.
      }}
    />
  );
}
