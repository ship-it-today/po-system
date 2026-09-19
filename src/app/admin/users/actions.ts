"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/types";

function back(params: Record<string, string>): never {
  redirect(`/admin/users?${new URLSearchParams(params).toString()}`);
}

export async function setRole(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as Role;
  if (!ROLES.includes(role)) return;

  if (id === admin.id && role !== "admin") back({ error: "You can't remove your own admin role." });

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) back({ error: error.message });

  revalidatePath("/admin/users");
  back({ saved: "Role updated." });
}

export async function inviteUser(formData: FormData) {
  await requireRole(["admin"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "requester") as Role;
  if (!email || !email.includes("@")) back({ error: "Enter a valid email address." });
  if (!ROLES.includes(role)) back({ error: "Invalid role." });

  const admin = createAdminClient();
  if (!admin) back({ error: "Invites aren't configured yet. Add SUPABASE_SECRET_KEY on Vercel (see README)." });

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account?welcome=1")}`,
  });
  if (error) {
    const msg = /already|exists|registered/i.test(error.message)
      ? "That email already has an account."
      : error.message;
    back({ error: msg });
  }

  // The DB trigger created the profile as a requester; bump the role if needed.
  if (data?.user && role !== "requester") {
    await admin.from("profiles").update({ role, full_name }).eq("id", data.user.id);
  } else if (data?.user && full_name) {
    await admin.from("profiles").update({ full_name }).eq("id", data.user.id);
  }

  revalidatePath("/admin/users");
  back({ saved: `Invitation sent to ${email}.` });
}

export async function resendInvite(formData: FormData) {
  await requireRole(["admin"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const admin = createAdminClient();
  if (!admin) back({ error: "Invites aren't configured yet. Add SUPABASE_SECRET_KEY on Vercel (see README)." });

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  // Re-inviting an existing, never-signed-in user resends the email.
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account?welcome=1")}`,
  });
  if (error) back({ error: error.message });
  back({ saved: `Invitation re-sent to ${email}.` });
}

async function adminOrBack() {
  const admin = createAdminClient();
  if (!admin) back({ error: "User management needs SUPABASE_SECRET_KEY on Vercel (see README)." });
  return admin;
}

/** Revoke access: user can no longer sign in; their POs and history are kept. */
export async function removeUser(formData: FormData) {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (id === me.id) back({ error: "You can't remove your own access." });
  const admin = await adminOrBack();

  const { error: banErr } = await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" }); // ~100 years
  if (banErr) back({ error: banErr.message });
  const { error } = await admin.from("profiles").update({ disabled: true }).eq("id", id);
  if (error) back({ error: error.message });

  revalidatePath("/admin/users");
  back({ saved: "Access removed. Their purchase orders are kept." });
}

export async function restoreUser(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const admin = await adminOrBack();

  const { error: banErr } = await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
  if (banErr) back({ error: banErr.message });
  const { error } = await admin.from("profiles").update({ disabled: false }).eq("id", id);
  if (error) back({ error: error.message });

  revalidatePath("/admin/users");
  back({ saved: "Access restored." });
}

/** Permanently delete. Only allowed when the user has no purchase orders. */
export async function deleteUser(formData: FormData) {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (id === me.id) back({ error: "You can't delete yourself." });
  const admin = await adminOrBack();

  // Second check on the server: the typed confirmation must match the account's email.
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  const { data: target } = await admin.from("profiles").select("email").eq("id", id).maybeSingle();
  if (!target) back({ error: "User not found." });
  if (typed !== target.email.toLowerCase()) back({ error: "Confirmation text didn't match the email. Nothing was deleted." });

  const { count } = await admin
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .or(`requester_id.eq.${id},approver_id.eq.${id}`);
  if ((count ?? 0) > 0)
    back({ error: "This person has purchase orders on record. Use “Remove access” instead so history is kept." });

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) back({ error: error.message });

  revalidatePath("/admin/users");
  back({ saved: "User deleted." });
}
