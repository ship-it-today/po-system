"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function siteOrigin(h: Headers) {
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = (formData.get("next") as string) || "/";
  const origin = siteOrigin(await headers());

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: "offline", prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signInWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = (formData.get("next") as string) || "/";

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
