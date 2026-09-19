import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/types";
import { canApprove, displayName } from "@/lib/types";
import MobileMore from "./MobileMore";
import MobileTab from "./MobileTab";

export default function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const approver = canApprove(profile.role);
  const admin = profile.role === "admin";

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* Desktop / tablet header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="font-semibold text-slate-900">
              Purchase Orders
            </Link>
            <span className="hidden md:contents">
              <Link href="/" className="text-slate-600 hover:text-slate-900">
                New PO
              </Link>
              <Link href="/history" className="text-slate-600 hover:text-slate-900">
                My POs
              </Link>
              {approver && (
                <Link href="/approvals" className="text-slate-600 hover:text-slate-900">
                  {admin ? "All POs" : "Approvals"}
                </Link>
              )}
              {approver && (
                <Link href="/reports" className="text-slate-600 hover:text-slate-900">
                  Reports
                </Link>
              )}
              {admin && (
                <Link href="/admin/users" className="text-slate-600 hover:text-slate-900">
                  Users
                </Link>
              )}
              {admin && (
                <Link href="/admin/budgets" className="text-slate-600 hover:text-slate-900">
                  Budgets
                </Link>
              )}
            </span>
          </nav>
          <div className="hidden md:flex items-center gap-3 text-sm">
            <Link href="/account" className="text-slate-600 hover:text-slate-900">
              {displayName(profile)}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">
                {profile.role}
              </span>
            </Link>
            <form action={signOut}>
              <button className="text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
          <Link href="/account" className="md:hidden text-sm text-slate-600">
            {displayName(profile).split(" ")[0]}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-8">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className={`grid ${approver ? "grid-cols-4" : "grid-cols-3"} h-14 text-[11px]`}>
          <MobileTab href="/" label="New PO" icon="M12 5v14M5 12h14" />
          <MobileTab href="/history" label="My POs" icon="M4 6h16M4 12h16M4 18h10" />
          {approver && <MobileTab href="/approvals" label={admin ? "All POs" : "Approvals"} icon="M9 12l2 2 4-4M5 5h14v14H5z" />}
          <MobileMore approver={approver} admin={admin} />
        </div>
      </nav>
    </div>
  );
}
