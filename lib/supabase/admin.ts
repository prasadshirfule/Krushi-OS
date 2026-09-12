import { createClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase admin client.
 * Uses SUPABASE_SERVICE_ROLE_KEY if available (to bypass RLS for system tasks),
 * otherwise falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *
 * NOTE: NEVER import or use this client in client components.
 */
export function createServerAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ADMIN_KEY ||
    process.env.SUPABASE_ROLE_KEY;

  if (!url || url.includes('placeholder')) {
    return null;
  }

  if (!serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
