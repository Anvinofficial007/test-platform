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

  const { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "No attempt found for this test" }, { status: 404 });
  }
  if (attempt.status === "submitted") {
    return NextResponse.json({ error: "This attempt was already submitted" }, { status: 403 });
  }

  const { data: test } = await supabase.from("tests").select("*").eq("id", id).single();
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  const body = await req.json();
  const answers: Record<string, string | null> = body.answers ?? {};

  const admin = createAdminClient();
  const { data: questions } = await admin.from("questions").select("*").eq("test_id", id);

  let score = 0;
  let correct_count = 0;
  let wrong_count = 0;
  let unanswered_count = 0;
  const answerRows: {
    attempt_id: string;
    question_id: string;
    selected_answer: "A" | "B" | "C" | "D" | null;
    is_correct: boolean;
    marks_awarded: number;
  }[] = [];

  const breakdown = (questions ?? []).map((q) => {
    const selected = (answers[q.id] as "A" | "B" | "C" | "D" | null) ?? null;
    let marks_awarded = 0;
    let is_correct = false;

    if (selected === null) {
      unanswered_count++;
    } else if (selected === q.correct_answer) {
      is_correct = true;
      marks_awarded = q.marks;
      correct_count++;
    } else {
      marks_awarded = -q.negative_marks;
      wrong_count++;
    }

    score += marks_awarded;
    answerRows.push({
      attempt_id: attempt.id,
      question_id: q.id,
      selected_answer: selected,
      is_correct,
      marks_awarded,
    });

    return {
      question_id: q.id,
      selected,
      correct: q.correct_answer,
      is_correct,
      marks_awarded,
    };
  });

  score = Math.round(score * 100) / 100;

  // Write answers + finalize the attempt. Uses the admin client for the bulk
  // upsert (simpler than chaining per-row RLS-scoped calls); ownership was
  // already verified above via the RLS-scoped `attempt` lookup.
  await admin.from("answers").upsert(answerRows, { onConflict: "attempt_id,question_id" });
  await admin
    .from("attempts")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), score })
    .eq("id", attempt.id);

  const total_marks = (questions ?? []).reduce((sum, q) => sum + q.marks, 0);

  return NextResponse.json({
    score,
    total_marks,
    correct_count,
    wrong_count,
    unanswered_count,
    breakdown,
  });
}
