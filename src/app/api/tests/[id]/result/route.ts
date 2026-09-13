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
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  let { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "No submitted result for this test" }, { status: 404 });
  }

  const admin = createAdminClient();

  // Covers the case where the student never came back to the test page
  // after time ran out (so the tab-open auto-finalize path never fired) —
  // e.g. they closed the laptop, then later opened the result link directly.
  attempt = await finalizeIfExpired(admin, id, attempt, test.duration_minutes);

  if (attempt.status !== "submitted") {
    return NextResponse.json({ error: "No submitted result for this test" }, { status: 404 });
  }

  const { data: questions } = await admin
    .from("questions")
    .select("*")
    .eq("test_id", id)
    .order("order_index", { ascending: true });
  const { data: answers } = await admin.from("answers").select("*").eq("attempt_id", attempt.id);

  const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));

  let correct_count = 0;
  let wrong_count = 0;
  let unanswered_count = 0;

  const breakdown = (questions ?? []).map((q) => {
    const a = answerByQuestion.get(q.id);
    if (!a || a.selected_answer === null) unanswered_count++;
    else if (a.is_correct) correct_count++;
    else wrong_count++;

    return {
      question_id: q.id,
      selected: a?.selected_answer ?? null,
      correct: q.correct_answer,
      is_correct: a?.is_correct ?? false,
      marks_awarded: a?.marks_awarded ?? 0,
    };
  });

  const total_marks = (questions ?? []).reduce((sum, q) => sum + q.marks, 0);

  return NextResponse.json({
    score: attempt.score ?? 0,
    total_marks,
    correct_count,
    wrong_count,
    unanswered_count,
    breakdown,
  });
}
