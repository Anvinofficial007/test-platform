import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeIfExpired } from "@/lib/scoring";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: test } = await supabase.from("tests").select("*").eq("id", id).single();
  if (!test || test.status !== "published") {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  const now = Date.now();
  if (now < new Date(test.start_time).getTime() || now > new Date(test.end_time).getTime()) {
    return NextResponse.json({ error: "This test is not available right now" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Find or create this student's attempt. RLS ("Students manage their own
  // attempts") lets this insert succeed only for the signed-in user's own
  // row, but two rapid page loads (e.g. a double-click, or a flaky network
  // causing a retry) can race and both try to insert — the DB's unique
  // (test_id, user_id) constraint stops a duplicate row from landing, and
  // we just re-fetch the winner here instead of erroring.
  let { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    const { data: created, error } = await supabase
      .from("attempts")
      .insert({ test_id: id, user_id: user.id, status: "in_progress" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Someone else's concurrent request won the race — fetch their row.
        const { data: existing } = await supabase
          .from("attempts")
          .select("*")
          .eq("test_id", id)
          .eq("user_id", user.id)
          .single();
        attempt = existing ?? null;
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      attempt = created;
    }
  }

  if (!attempt) {
    return NextResponse.json({ error: "Could not start or resume an attempt" }, { status: 500 });
  }

  // If time ran out while nobody was looking (tab closed, device died, lost
  // connection) this finalizes it now using whatever was last synced —
  // rather than leaving it stuck "in_progress" forever.
  attempt = await finalizeIfExpired(admin, id, attempt, test.duration_minutes);

  if (attempt.status === "submitted") {
    return NextResponse.json({ error: "This attempt has already been submitted", finalized: true }, { status: 403 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "This attempt is no longer active" }, { status: 403 });
  }

  // Questions are read with the admin client because RLS intentionally has
  // no client-facing select policy on this table — correct_answer must never
  // reach the browser, so we strip it here on the server before responding.
  const { data: questions } = await admin
    .from("questions")
    .select("*")
    .eq("test_id", id)
    .order("order_index", { ascending: true });

  const safeQuestions = (questions ?? []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    question_image_url: q.question_image_url,
    marks: q.marks,
    negative_marks: q.negative_marks,
    options: [
      { key: "A" as const, text: q.option_a_text, image_url: q.option_a_image_url ?? undefined },
      { key: "B" as const, text: q.option_b_text, image_url: q.option_b_image_url ?? undefined },
      { key: "C" as const, text: q.option_c_text, image_url: q.option_c_image_url ?? undefined },
      { key: "D" as const, text: q.option_d_text, image_url: q.option_d_image_url ?? undefined },
    ],
  }));

  // Resume support: hand back whatever answers were already synced to the
  // DB (from a previous session, a different tab, or a refresh), so the
  // client isn't relying on localStorage alone to restore progress.
  const { data: savedAnswers } = await admin
    .from("answers")
    .select("question_id, selected_answer")
    .eq("attempt_id", attempt.id);

  const savedAnswersMap: Record<string, string | null> = {};
  for (const a of savedAnswers ?? []) {
    savedAnswersMap[a.question_id] = a.selected_answer;
  }

  // Remaining time is derived from the server-recorded started_at, not the
  // client clock, so refreshing the page (or a slow connection) can't extend it.
  const elapsedSeconds = Math.floor((now - new Date(attempt.started_at).getTime()) / 1000);
  const totalSeconds = test.duration_minutes * 60;
  const secondsLeft = Math.max(0, totalSeconds - elapsedSeconds);

  return NextResponse.json({
    test,
    questions: safeQuestions,
    attempt,
    secondsLeft,
    savedAnswers: savedAnswersMap,
  });
}
