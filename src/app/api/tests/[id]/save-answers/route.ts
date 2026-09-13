import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // RLS-scoped lookup proves this attempt belongs to the caller before we
  // touch the service-role client — same ownership check pattern as submit.
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, status")
    .eq("test_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "No attempt found" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    // Already submitted/expired — nothing to sync, and we don't want a
    // stray autosave tick to overwrite a finalized answer.
    return NextResponse.json({ ok: false, reason: "not_in_progress" });
  }

  const body = await req.json();
  const answers: Record<string, string | null> = body.answers ?? {};

  const admin = createAdminClient();
  const rows = Object.entries(answers)
    .filter(([, v]) => v !== undefined)
    .map(([question_id, selected_answer]) => ({
      attempt_id: attempt.id,
      question_id,
      selected_answer: (selected_answer || null) as "A" | "B" | "C" | "D" | null,
    }));

  if (rows.length > 0) {
    const { error } = await admin.from("answers").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: rows.length });
}
