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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Profile row is created by a DB trigger; if it's missing something is off.
    redirect("/login?error=no_profile");
  }
  return profile as Profile;
}

export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/?error=forbidden");
  return profile;
}
