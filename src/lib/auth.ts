import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

/** Returns the signed-in user's profile or redirects to /login. */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Most likely the schema hasn't been run yet (table missing).
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("Database not set up: " + error.message)}`);
  }

  if (profile) {
    if ((profile as Profile).disabled) {
      await supabase.auth.signOut();
      redirect(`/login?error=${encodeURIComponent("Your access has been removed. Contact an admin.")}`);
    }
    return profile as Profile;
  }

  // No profile row (user was created before the schema/trigger existed). Create one now.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
    })
    .select("*")
    .single();

  if (insErr || !created) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("Could not create your profile: " + (insErr?.message ?? "unknown"))}`);
  }
  return created as Profile;
}

export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/?error=forbidden");
  return profile;
}
