import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/types";
import { canApprove, displayName } from "@/lib/types";

export default function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="font-semibold text-slate-900">
              Purchase Orders
            </Link>
            <Link href="/" className="text-slate-600 hover:text-slate-900">
              My POs
            </Link>
            <Link href="/po/new" className="text-slate-600 hover:text-slate-900">
              New PO
            </Link>
            {canApprove(profile.role) && (
              <Link href="/approvals" className="text-slate-600 hover:text-slate-900">
                Approvals
              </Link>
            )}
            {profile.role === "admin" && (
              <Link href="/admin/users" className="text-slate-600 hover:text-slate-900">
                Users
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600 hidden sm:inline">
              {displayName(profile)}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">
                {profile.role}
              </span>
            </span>
            <form action={signOut}>
              <button className="text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
