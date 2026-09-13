"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { requireAdmin } from "@/lib/supabase/adminGuard";

// ── Tests ────────────────────────────────────────────────────────────────

export async function createTest(formData: FormData) {
  const { admin } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const duration_minutes = Number(formData.get("duration_minutes"));
  const start_time = String(formData.get("start_time"));
  const negative_marks_default = Number(formData.get("negative_marks_default") ?? 0);

  if (!title || !duration_minutes || !start_time) {
    throw new Error("Title, duration, and start time are required");
  }

  const start = new Date(start_time);
  const end = new Date(start.getTime() + duration_minutes * 60 * 1000);

  const { data, error } = await admin
    .from("tests")
    .insert({
      title,
      description,
      duration_minutes,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      total_marks: 0,
      status: "draft",
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create test");

  // Stash the default negative marking as a hint for the "add question" form
  // (not persisted server-side beyond this redirect — purely a UI convenience).
  redirect(`/admin/tests/${data.id}?neg=${negative_marks_default}`);
}

export async function updateTestStatus(testId: string, status: "draft" | "published" | "closed") {
  const { admin } = await requireAdmin();
  const { error } = await admin.from("tests").update({ status }).eq("id", testId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tests/${testId}`);
  revalidatePath("/admin/tests");
}

export async function updateTestSettings(testId: string, formData: FormData) {
  const { admin } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const duration_minutes = Number(formData.get("duration_minutes"));
  const start_time = String(formData.get("start_time"));

  if (!title || !duration_minutes || !start_time) {
    throw new Error("Title, duration, and start time are required");
  }

  const start = new Date(start_time);
  const end = new Date(start.getTime() + duration_minutes * 60 * 1000);

  const { error } = await admin
    .from("tests")
    .update({
      title,
      description,
      duration_minutes,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    })
    .eq("id", testId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tests/${testId}`);
}

async function recalcTotalMarks(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"], testId: string) {
  const { data: questions } = await admin.from("questions").select("marks").eq("test_id", testId);
  const total = (questions ?? []).reduce((sum, q) => sum + q.marks, 0);
  await admin.from("tests").update({ total_marks: total }).eq("id", testId);
}

// Uploads an optional image file (by form field name) to the question-images
// bucket and returns its public URL, or null if no file was chosen.
async function uploadImageIfPresent(
  admin: Awaited<ReturnType<typeof requireAdmin>>["admin"],
  formData: FormData,
  field: string,
  testId: string
): Promise<string | null> {
  const file = formData.get(field) as File | null;
  if (!file || file.size === 0) return null;

  const ext = file.name.split(".").pop() || "png";
  const path = `${testId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage.from("question-images").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed (${field}): ${error.message}`);

  const { data } = admin.storage.from("question-images").getPublicUrl(path);
  return data.publicUrl;
}

// ── Questions ────────────────────────────────────────────────────────────

export async function addQuestion(testId: string, formData: FormData) {
  const { admin } = await requireAdmin();

  const question_text = String(formData.get("question_text") ?? "").trim();
  const option_a_text = String(formData.get("option_a_text") ?? "").trim();
  const option_b_text = String(formData.get("option_b_text") ?? "").trim();
  const option_c_text = String(formData.get("option_c_text") ?? "").trim();
  const option_d_text = String(formData.get("option_d_text") ?? "").trim();
  const correct_answer = String(formData.get("correct_answer") ?? "") as "A" | "B" | "C" | "D";
  const marks = Number(formData.get("marks") ?? 1);
  const negative_marks = Number(formData.get("negative_marks") ?? 0);

  if (!question_text && !formData.get("question_image")) {
    throw new Error("Question needs text, an image, or both");
  }
  if (!option_a_text || !option_b_text || !option_c_text || !option_d_text) {
    throw new Error("All four options need text (an image can supplement, not replace, an option)");
  }
  if (!["A", "B", "C", "D"].includes(correct_answer)) {
    throw new Error("Select a valid correct answer");
  }

  // Uploaded once questions text/shape is validated, so a bad form submit
  // doesn't leave orphaned files in Storage.
  const [question_image_url, option_a_image_url, option_b_image_url, option_c_image_url, option_d_image_url] =
    await Promise.all([
      uploadImageIfPresent(admin, formData, "question_image", testId),
      uploadImageIfPresent(admin, formData, "option_a_image", testId),
      uploadImageIfPresent(admin, formData, "option_b_image", testId),
      uploadImageIfPresent(admin, formData, "option_c_image", testId),
      uploadImageIfPresent(admin, formData, "option_d_image", testId),
    ]);

  const { count } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("test_id", testId);

  const { error } = await admin.from("questions").insert({
    test_id: testId,
    question_text,
    question_image_url,
    option_a_text,
    option_a_image_url,
    option_b_text,
    option_b_image_url,
    option_c_text,
    option_c_image_url,
    option_d_text,
    option_d_image_url,
    correct_answer,
    marks,
    negative_marks,
    order_index: (count ?? 0) + 1,
  });

  if (error) throw new Error(error.message);
  await recalcTotalMarks(admin, testId);
  revalidatePath(`/admin/tests/${testId}`);
}

export async function deleteQuestion(testId: string, questionId: string) {
  const { admin } = await requireAdmin();
  const { error } = await admin.from("questions").delete().eq("id", questionId);
  if (error) throw new Error(error.message);
  await recalcTotalMarks(admin, testId);
  revalidatePath(`/admin/tests/${testId}`);
}

// Expected CSV header: Question,A,B,C,D,Answer,Marks,Negative
// (matches the format shown in the dev plan)
export async function importQuestionsCsv(testId: string, formData: FormData) {
  const { admin } = await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a CSV file first");

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const { count } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("test_id", testId);

  let nextIndex = (count ?? 0) + 1;
  const rows: {
    test_id: string;
    question_text: string;
    option_a_text: string;
    option_b_text: string;
    option_c_text: string;
    option_d_text: string;
    correct_answer: "A" | "B" | "C" | "D";
    marks: number;
    negative_marks: number;
    order_index: number;
  }[] = [];

  for (const [i, row] of parsed.data.entries()) {
    const question = row["question"]?.trim();
    const a = row["a"]?.trim();
    const b = row["b"]?.trim();
    const c = row["c"]?.trim();
    const d = row["d"]?.trim();
    const answer = row["answer"]?.trim().toUpperCase() as "A" | "B" | "C" | "D";
    const marks = Number(row["marks"] ?? 1) || 1;
    const negative = Number(row["negative"] ?? 0) || 0;

    if (!question || !a || !b || !c || !d) {
      throw new Error(`Row ${i + 2}: missing question text or an option`);
    }
    if (!["A", "B", "C", "D"].includes(answer)) {
      throw new Error(`Row ${i + 2}: Answer must be A, B, C, or D (got "${row["answer"]}")`);
    }

    rows.push({
      test_id: testId,
      question_text: question,
      option_a_text: a,
      option_b_text: b,
      option_c_text: c,
      option_d_text: d,
      correct_answer: answer,
      marks,
      negative_marks: negative,
      order_index: nextIndex++,
    });
  }

  if (rows.length === 0) throw new Error("No rows found in that CSV");

  const { error } = await admin.from("questions").insert(rows);
  if (error) throw new Error(error.message);

  await recalcTotalMarks(admin, testId);
  revalidatePath(`/admin/tests/${testId}`);
}

// ── Attempts ─────────────────────────────────────────────────────────────

export async function resetAttempt(testId: string, attemptId: string) {
  const { admin } = await requireAdmin();
  const { error } = await admin
    .from("attempts")
    .update({ status: "in_progress", submitted_at: null, score: null })
    .eq("id", attemptId);
  if (error) throw new Error(error.message);
  await admin.from("answers").delete().eq("attempt_id", attemptId);
  revalidatePath(`/admin/tests/${testId}`);
}

export async function disqualifyAttempt(testId: string, attemptId: string) {
  const { admin } = await requireAdmin();
  const { error } = await admin.from("attempts").update({ status: "disqualified" }).eq("id", attemptId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tests/${testId}`);
}
