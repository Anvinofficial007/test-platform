import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type Attempt = Database["public"]["Tables"]["attempts"]["Row"];

export type ScoreResult = {
  score: number;
  total_marks: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  breakdown: {
    question_id: string;
    selected: string | null;
    correct: string;
    is_correct: boolean;
    marks_awarded: number;
  }[];
};

/**
 * Scores an attempt using whatever answers are passed in, writes the
 * answers + final attempt row, and returns the result. Used both when a
 * student clicks Submit and when we lazily auto-finalize an attempt whose
 * time has run out (see finalizeIfExpired below) — same math, same writes,
 * one place to get it right.
 */
export async function finalizeAttempt(
  admin: AdminClient,
  testId: string,
  attemptId: string,
  answers: Record<string, string | null>
): Promise<ScoreResult> {
  const { data: questions } = await admin.from("questions").select("*").eq("test_id", testId);

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
      attempt_id: attemptId,
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

  if (answerRows.length > 0) {
    await admin.from("answers").upsert(answerRows, { onConflict: "attempt_id,question_id" });
  }
  await admin
    .from("attempts")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), score })
    .eq("id", attemptId);

  const total_marks = (questions ?? []).reduce((sum, q) => sum + q.marks, 0);

  return { score, total_marks, correct_count, wrong_count, unanswered_count, breakdown };
}

/**
 * If an attempt's time window has passed but it's still "in_progress"
 * (the student closed the tab, lost connection, or the device died before
 * they could hit Submit), finalize it using whatever answers were last
 * synced to the DB via /api/tests/[id]/save-answers. Called on every touch
 * point that reads an attempt (questions GET, result GET, admin list) so
 * an expired-but-unsubmitted attempt gets closed out the next time anyone
 * looks at it — without needing a separate always-on server process.
 */
export async function finalizeIfExpired(
  admin: AdminClient,
  testId: string,
  attempt: Attempt,
  durationMinutes: number
): Promise<Attempt> {
  if (attempt.status !== "in_progress") return attempt;

  const deadline = new Date(attempt.started_at).getTime() + durationMinutes * 60 * 1000;
  if (Date.now() < deadline) return attempt;

  const { data: savedAnswers } = await admin
    .from("answers")
    .select("question_id, selected_answer")
    .eq("attempt_id", attempt.id);

  const answersMap: Record<string, string | null> = {};
  for (const a of savedAnswers ?? []) {
    answersMap[a.question_id] = a.selected_answer;
  }

  await finalizeAttempt(admin, testId, attempt.id, answersMap);

  const { data: refreshed } = await admin.from("attempts").select("*").eq("id", attempt.id).single();
  return refreshed ?? attempt;
}
