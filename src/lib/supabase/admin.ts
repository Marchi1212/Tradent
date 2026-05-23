import { createClient } from "@supabase/supabase-js";

// Admin-Client mit Service Role Key – umgeht RLS.
// Nur server-seitig verwenden (API Routes, Cron Jobs).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
