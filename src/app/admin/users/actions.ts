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
