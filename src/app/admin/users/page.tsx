import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminInvitesEnabled, createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Profile } from "@/lib/types";
import { deleteUser, inviteUser, removeUser, resendInvite, restoreUser, setRole } from "./actions";
import DangerConfirm from "./DangerConfirm";

const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const btnCls = "rounded-md border px-2.5 py-1 text-xs font-medium";

type AuthInfo = { lastSignIn: string | null; invitedAt: string | null; banned: boolean };

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

  // Sign-in / invite details come from Supabase Auth (needs the secret key).
  const auth = new Map<string, AuthInfo>();
  const adminClient = createAdminClient();
  const managed = Boolean(adminClient);
  if (adminClient) {
    const { data: list } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) {
      auth.set(u.id, {
        lastSignIn: u.last_sign_in_at ?? null,
        invitedAt: u.invited_at ?? null,
        banned: Boolean((u as { banned_until?: string | null }).banned_until),
      });
    }
  }

  // PO counts, to decide whether hard delete is allowed.
  const { data: poRows } = await supabase.from("purchase_orders").select("requester_id, approver_id");
  const poCount = new Map<string, number>();
  for (const r of poRows ?? []) {
    for (const id of [r.requester_id, r.approver_id]) {
      if (id) poCount.set(id, (poCount.get(id) ?? 0) + 1);
    }
  }

  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/auth/users`
    : "https://supabase.com/dashboard";

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "");

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
            In-app invites and user removal aren&apos;t set up yet (add <code>SUPABASE_SECRET_KEY</code> on Vercel — see
            README). Until then, manage people from the{" "}
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
              {managed && <th className="px-4 py-2.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const info = auth.get(u.id);
              const isMe = u.id === admin.id;
              const removed = u.disabled || info?.banned;
              const pendingInvite = info ? !info.lastSignIn : false;
              const hasPOs = (poCount.get(u.id) ?? 0) > 0;

              return (
                <tr key={u.id} className={removed ? "bg-slate-50 text-slate-500" : undefined}>
                  <td className="px-4 py-2.5">
                    {u.full_name ?? <span className="text-slate-400">—</span>}
                    {isMe && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2.5">
                    {removed ? (
                      <span className="inline-block rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium">
                        Access removed
                      </span>
                    ) : !info ? (
                      <span className="text-slate-500">Joined {fmt(u.created_at)}</span>
                    ) : pendingInvite ? (
                      <div>
                        <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Invite pending
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Sent {fmt(info.invitedAt ?? u.created_at)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Active
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5">Last sign-in {fmt(info.lastSignIn)}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {removed ? (
                      <span className="capitalize">{u.role}</span>
                    ) : (
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
                    )}
                  </td>
                  {managed && (
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {!isMe && pendingInvite && !removed && (
                          <form action={resendInvite}>
                            <input type="hidden" name="email" value={u.email} />
                            <button className={`${btnCls} border-slate-300 bg-white hover:bg-slate-50`}>Resend invite</button>
                          </form>
                        )}
                        {!isMe && !removed && (
                          <form action={removeUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <DangerConfirm
                              label="Remove access"
                              title={`Remove access for ${u.full_name ?? u.email}?`}
                              description={`${u.email} will be signed out and won't be able to sign in again.\n\nTheir purchase orders and approvals are kept, and you can restore access later.`}
                              confirmLabel="Remove access"
                              className={`${btnCls} border-amber-300 bg-white text-amber-800 hover:bg-amber-50`}
                            />
                          </form>
                        )}
                        {!isMe && removed && (
                          <form action={restoreUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className={`${btnCls} border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50`}>
                              Restore
                            </button>
                          </form>
                        )}
                        {!isMe && !hasPOs && (
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <DangerConfirm
                              label="Delete"
                              title={`Permanently delete ${u.full_name ?? u.email}?`}
                              description={`This deletes the account for ${u.email}. It cannot be undone.\n\nIf you only want to stop them signing in, use Remove access instead.`}
                              confirmLabel="Delete permanently"
                              typeToConfirm={u.email}
                              className={`${btnCls} border-red-300 bg-white text-red-700 hover:bg-red-50`}
                            />
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {managed && (
        <p className="mt-4 text-xs text-slate-500">
          <strong>Remove access</strong> blocks sign-in but keeps the person&apos;s purchase orders (you can restore them).{" "}
          <strong>Delete</strong> is only offered for people with no purchase orders on record.
        </p>
      )}
    </AppShell>
  );
}
