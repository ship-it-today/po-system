"use client";

import { useId, useState } from "react";

/**
 * Two-step confirmation for destructive admin actions.
 * Step 1: click the button → a dialog explains what will happen.
 * Step 2: (optional) type the exact phrase, then click the red confirm button.
 * The typed phrase is also submitted so the server can verify it.
 */
export default function DangerConfirm({
  label,
  title,
  description,
  confirmLabel,
  typeToConfirm,
  className,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** When set, the user must type this exact text before confirming. */
  typeToConfirm?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const id = useId();
  const ready = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl text-left">
            <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{description}</p>

            {typeToConfirm && (
              <label className="block mt-4">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Type <span className="font-mono text-slate-900">{typeToConfirm}</span> to confirm
                </span>
                <input
                  name="confirm"
                  autoFocus
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ready}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
