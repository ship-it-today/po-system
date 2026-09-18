"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/types";

export async function setRole(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as Role;
  if (!ROLES.includes(role)) return;

  if (id === admin.id && role !== "admin") {
    redirect(`/admin/users?error=${encodeURIComponent("You can't remove your own admin role.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}
