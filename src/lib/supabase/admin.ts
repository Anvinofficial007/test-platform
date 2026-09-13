import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// SERVER-ONLY. Never import this file from a Client Component — the
// service role key bypasses Row Level Security entirely. It exists so
// our API routes (running on the server) can read correct_answer for
// scoring, while every response we send back to the browser strips it.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
