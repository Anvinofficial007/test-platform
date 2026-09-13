import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class NotAdminError extends Error {
  constructor() {
    super("Admin access required");
  }
}

// Every admin server action calls this first. It uses the RLS-scoped
// server client to identify who's signed in, then checks their role.
// Only after this passes do actions touch the service-role admin client.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new NotAdminError();

  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") throw new NotAdminError();

  return { userId: user.id, name: profile.name, admin: createAdminClient() };
}
