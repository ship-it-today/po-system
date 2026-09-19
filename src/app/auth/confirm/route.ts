import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles email links built with {{ .TokenHash }} (invite, magic link, recovery,
// signup confirmation). See README "Email templates".
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next =
    searchParams.get("next") ??
    (type === "invite" || type === "recovery" ? "/account?welcome=1" : "/");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That link is invalid or has expired. Ask an admin to send a new one.")}`);
}
