"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function updateName(formData: FormData) {
  const profile = await requireProfile();
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name }).eq("id", profile.id);
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/account");
  redirect("/account?saved=1");
}

export async function updatePassword(formData: FormData) {
  await requireProfile();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) redirect(`/account?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  if (password !== confirm) redirect(`/account?error=${encodeURIComponent("Passwords don't match.")}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);
  redirect("/account?saved=1");
}
