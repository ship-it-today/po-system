"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase's default email links (dashboard invites, magic links, password
 * resets) land on the Site URL with the session in the URL fragment
 * (#access_token=...). Servers can't see fragments, so this picks it up in
 * the browser, stores the session, and sends the user on.
 */
export default function HashSession() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;
    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");
    if (!access_token || !refresh_token) return;

    // Deferred so the first client render matches the server render.
    Promise.resolve().then(() => setBusy(true));
    const supabase = createClient();
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        setBusy(false);
        router.replace(`/login?error=${encodeURIComponent(error.message)}`);
        return;
      }
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(type === "invite" || type === "recovery" ? "/account?welcome=1" : "/");
      router.refresh();
    });
  }, [router]);

  if (!busy) return null;
  return (
    <p className="mt-4 text-sm text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-3 py-2">
      Signing you in…
    </p>
  );
}
