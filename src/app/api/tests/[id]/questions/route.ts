import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Find or create this student's attempt. RLS ("Students manage their own
  // attempts") lets this insert succeed only for the signed-in user's own row.
  let { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (attempt?.status === "submitted") {
    return NextResponse.json({ error: "You have already submitted this test" }, { status: 403 });
  }

  if (!attempt) {
    const { data: created, error } = await supabase
      .from("attempts")
      .insert({ test_id: id, user_id: user.id, status: "in_progress" })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    attempt = created;
  }

  // Questions are read with the admin client because RLS intentionally has
  // no client-facing select policy on this table — correct_answer must never
  // reach the browser, so we strip it here on the server before responding.
  const admin = createAdminClient();
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

  // Remaining time is derived from the server-recorded started_at, not the
  // client clock, so refreshing the page (or a slow connection) can't extend it.
  const elapsedSeconds = Math.floor((now - new Date(attempt.started_at).getTime()) / 1000);
  const totalSeconds = test.duration_minutes * 60;
  const secondsLeft = Math.max(0, totalSeconds - elapsedSeconds);

  return NextResponse.json({ test, questions: safeQuestions, attempt, secondsLeft });
}
