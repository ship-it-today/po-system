import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES, type Profile } from "@/lib/types";
import { setRole } from "./actions";

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

  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const inviteUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/auth/users`
    : "https://supabase.com/dashboard";

  return (
    <AppShell profile={admin}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold">Users &amp; roles</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Requesters submit POs · Approvers review them · Admins manage users.
          </p>
        </div>
        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 whitespace-nowrap"
        >
          Invite user ↗
        </a>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}
      {saved && (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          Role updated.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Joined</th>
              <th className="px-4 py-2.5">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">{u.full_name ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
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
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        To add someone, use <strong>Invite user</strong> in the Supabase dashboard (Authentication → Users → Invite),
        or have them sign in with Google. New accounts start as <em>requester</em>.
      </p>
    </AppShell>
  );
}
