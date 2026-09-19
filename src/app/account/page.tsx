import AppShell from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateName, updatePassword } from "./actions";

const ROLE_HELP: Record<string, string> = {
  requester: "You can submit purchase orders and track their status.",
  approver: "You can submit purchase orders and approve or deny everyone's requests.",
  admin: "You can do everything, including managing users and roles.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const profile = await requireProfile();
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const [{ count: total }, { count: pending }] = await Promise.all([
    supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("requester_id", profile.id),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", profile.id)
      .eq("status", "pending"),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const usesPassword = user?.app_metadata?.provider === "email";

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

  return (
    <AppShell profile={profile}>
      <h1 className="text-xl font-semibold mb-6">Account</h1>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}
      {saved && (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          Saved.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <dl className="text-sm space-y-3 mb-5">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-0.5">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Role</dt>
              <dd className="mt-0.5 capitalize">{profile.role}</dd>
              <dd className="text-xs text-slate-500 mt-0.5">{ROLE_HELP[profile.role]}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Purchase orders</dt>
              <dd className="mt-0.5">
                {total ?? 0} submitted · {pending ?? 0} pending
              </dd>
            </div>
          </dl>
          <form action={updateName} className="space-y-2">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Display name</span>
              <input name="full_name" defaultValue={profile.full_name ?? ""} className={inputCls} placeholder="Your name" />
            </label>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Save name
            </button>
          </form>
        </section>

        {usesPassword && (
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="font-semibold mb-4">Change password</h2>
            <form action={updatePassword} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">New password</span>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</span>
                <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
              </label>
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Update password
              </button>
            </form>
          </section>
        )}
      </div>
    </AppShell>
  );
}
