import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client using the SECRET key. Never import this from a client
 * component. It bypasses row-level security, so callers must check the
 * signed-in user's role first (see requireRole).
 *
 * Returns null when SUPABASE_SECRET_KEY isn't configured so the UI can fall
 * back to the Supabase dashboard.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const adminInvitesEnabled = () => Boolean(process.env.SUPABASE_SECRET_KEY);
