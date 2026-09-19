import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminInvitesEnabled, createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Profile } from "@/lib/types";
import { inviteUser, resendInvite, setRole } from "./actions";

const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const admin = await requireRole(["admin"]);
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.from("profiles").select("*").order("created_at");
  const users = (data ?? []) as Profile[];

  // Who has actually signed in yet? (needs the secret key; optional)
  const signedIn = new Map<string, boolean>();
  const adminClient = createAdminClient();
  if (adminClient) {
    const { data: list } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) signedIn.set(u.id, Boolean(u.last_sign_in_at));
  }

  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/auth/users`
    : "https://supabase.com/dashboard";

  return (
    <AppShell profile={admin}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Users &amp; roles</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Requesters submit POs · Approvers review them · Admins manage users.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}
      {saved && (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          {saved}
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6 mb-6">
        <h2 className="font-semibold mb-1">Invite someone</h2>
        {adminInvitesEnabled() ? (
          <>
            <p className="text-sm text-slate-500 mb-4">
              They&apos;ll get an email with a link to set their password.
            </p>
            <form action={inviteUser} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <label className="block sm:col-span-5">
                <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
                <input name="email" type="email" required className={inputCls} placeholder="name@example.com" />
              </label>
              <label className="block sm:col-span-3">
                <span className="block text-xs font-medium text-slate-600 mb-1">Name (optional)</span>
                <input name="full_name" className={inputCls} />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-xs font-medium text-slate-600 mb-1">Role</span>
                <select name="role" defaultValue="requester" className={`${inputCls} capitalize`}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <button className="sm:col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Send invite
              </button>
            </form>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            In-app invites aren&apos;t set up yet (add <code>SUPABASE_SECRET_KEY</code> on Vercel — see README). Until
            then, invite people from the{" "}
            <a href={dashboardUrl} target="_blank" rel="noreferrer" className="underline">
              Supabase dashboard ↗
            </a>
            .
          </p>
        )}
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const known = signedIn.has(u.id);
              const active = signedIn.get(u.id);
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">{u.full_name ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2.5">
                    {!known ? (
                      <span className="text-slate-500">Joined {new Date(u.created_at).toLocaleDateString()}</span>
                    ) : active ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="flex items-center gap-2 text-amber-800">
                        Invited
                        <form action={resendInvite}>
                          <input type="hidden" name="email" value={u.email} />
                          <button className="text-xs underline text-slate-500 hover:text-slate-900">Resend</button>
                        </form>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={setRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm capitalize"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
