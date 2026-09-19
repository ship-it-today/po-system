"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/app/login/actions";

export default function MobileMore({ approver, admin }: { approver: boolean; admin: boolean }) {
  const [open, setOpen] = useState(false);
  const item = "block px-4 py-3 text-sm text-slate-800 hover:bg-slate-50";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-0.5 text-slate-600 active:bg-slate-50"
        aria-haspopup="dialog"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
        </svg>
        More
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-slate-300" />
            {approver && <Link href="/reports" className={item} onClick={() => setOpen(false)}>Reports</Link>}
            {admin && <Link href="/admin/users" className={item} onClick={() => setOpen(false)}>Users</Link>}
            {admin && <Link href="/admin/budgets" className={item} onClick={() => setOpen(false)}>Budgets</Link>}
            <Link href="/account" className={item} onClick={() => setOpen(false)}>Account</Link>
            <form action={signOut}>
              <button className={`${item} w-full text-left text-slate-500`}>Sign out</button>
            </form>
            <button type="button" onClick={() => setOpen(false)} className="w-full border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
