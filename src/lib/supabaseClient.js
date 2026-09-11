import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────
// Supabase Client — Singleton
//
// Environment variables are injected by Vite at build time.
// Create a .env.local file in the project root with:
//
//   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
//
// Never expose the service_role key in client code.
// ─────────────────────────────────────────────────────────────

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Supabase] Missing environment variables.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist the user session across page reloads via localStorage
    persistSession: true,
    // Automatically refresh the JWT before it expires
    autoRefreshToken: true,
    // Detect the OAuth callback hash fragment automatically
    detectSessionInUrl: true,
  },
});
