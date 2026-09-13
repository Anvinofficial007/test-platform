export type QuestionAnalytics = {
  id: string;
  text: string;
  order_index: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  attempted_count: number;
  accuracy: number;
  difficulty: "easy" | "medium" | "hard";
};

export type TestAnalytics = {
  test_id: string;
  title: string;
  total_attempts: number;
  submitted_count: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  top_performer: {
    name: string | null;
    register_number: string | null;
    score: number | null;
  } | null;
  question_stats: QuestionAnalytics[];
};

export async function getTestAnalytics(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  testId: string,
  title?: string
): Promise<TestAnalytics> {
  const [{ data: questions }, { data: attempts }] = await Promise.all([
    admin.from("questions").select("*").eq("test_id", testId).order("order_index", { ascending: true }),
    admin.from("attempts").select("*").eq("test_id", testId),
  ]);

  const submitted = (attempts ?? []).filter((attempt) => attempt.status === "submitted");
  const submittedIds = submitted.map((attempt) => attempt.id);

  const { data: detailedAnswers } =
    submittedIds.length > 0
      ? await admin
          .from("answers")
          .select("attempt_id, question_id, is_correct")
          .in("attempt_id", submittedIds)
      : { data: [] as Array<{ attempt_id: string; question_id: string; is_correct: boolean | null }> };

  const questionStats: QuestionAnalytics[] = (questions ?? []).map((question) => {
    const rows = (detailedAnswers ?? []).filter((row) => row.question_id === question.id);
    const correct_count = rows.filter((row) => row.is_correct === true).length;
    const incorrect_count = rows.filter((row) => row.is_correct === false).length;
    const attempted_count = correct_count + incorrect_count;
    const unanswered_count = submitted.length - attempted_count;
    const accuracy = attempted_count > 0 ? (correct_count / attempted_count) * 100 : 0;

    let difficulty: QuestionAnalytics["difficulty"] = "medium";
    if (accuracy >= 70) difficulty = "easy";
    else if (accuracy <= 35) difficulty = "hard";

    return {
      id: question.id,
      text: question.question_text || "Question",
      order_index: question.order_index,
      correct_count,
      incorrect_count,
      unanswered_count,
      attempted_count,
      accuracy,
      difficulty,
    };
  });

  const scores = submitted.map((attempt) => attempt.score ?? 0);
  const average_score = submitted.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / submitted.length : 0;
  const highest_score = submitted.length > 0 ? Math.max(...scores) : 0;
  const lowest_score = submitted.length > 0 ? Math.min(...scores) : 0;

  const userIds = [...new Set(submitted.map((attempt) => attempt.user_id))];
  const { data: userRows } = userIds.length
    ? await admin.from("users").select("id, name, register_number").in("id", userIds)
    : { data: [] as Array<{ id: string; name: string | null; register_number: string | null }> };

  const userById = new Map((userRows ?? []).map((user) => [user.id, user]));
  const topPerformer = submitted
    .map((attempt) => ({
      name: userById.get(attempt.user_id)?.name ?? null,
      register_number: userById.get(attempt.user_id)?.register_number ?? null,
      score: attempt.score ?? null,
    }))
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))[0] ?? null;

  return {
    test_id: testId,
    title: title ?? "Untitled test",
    total_attempts: attempts?.length ?? 0,
    submitted_count: submitted.length,
    average_score: Number(average_score.toFixed(2)),
    highest_score: Number(highest_score.toFixed(2)),
    lowest_score: Number(lowest_score.toFixed(2)),
    top_performer: topPerformer,
    question_stats: questionStats.sort((a, b) => a.order_index - b.order_index),
  };
}
