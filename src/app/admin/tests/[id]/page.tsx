import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeIfExpired } from "@/lib/scoring";
import { getTestAnalytics } from "@/lib/analytics";
import {
  addQuestion,
  deleteQuestion,
  disqualifyAttempt,
  importQuestionsCsv,
  resetAttempt,
  updateTestSettings,
  updateTestStatus,
} from "@/app/admin/actions";
import { formatInAppTz, liveMinutesFromWindow, toDatetimeLocalValue } from "@/lib/time";

export default async function AdminTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: test } = await admin.from("tests").select("*").eq("id", id).single();
  if (!test) notFound();

  const { data: questions } = await admin
    .from("questions")
    .select("*")
    .eq("test_id", id)
    .order("order_index", { ascending: true });

  const { data: attemptsRaw } = await admin
    .from("attempts")
    .select("*")
    .eq("test_id", id)
    .order("score", { ascending: false, nullsFirst: false });

  // Close out anyone whose time ran out but who never got a chance to
  // submit (or auto-finalize via the test/result page) — so the admin view
  // always reflects reality rather than stale "in_progress" rows.
  const finalized = await Promise.all(
    (attemptsRaw ?? []).map((a) => finalizeIfExpired(admin, id, a, test.duration_minutes))
  );

  const userIds = [...new Set(finalized.map((a) => a.user_id))];
  const { data: attemptUsers } = userIds.length
    ? await admin.from("users").select("id, name, register_number").in("id", userIds)
    : { data: [] };
  const userById = new Map((attemptUsers ?? []).map((u) => [u.id, u]));
  const attempts = finalized
    .map((a) => ({ ...a, user: userById.get(a.user_id) }))
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));

  const submitted = attempts.filter((a) => a.status === "submitted");
  const avgScore =
    submitted.length > 0
      ? submitted.reduce((sum, a) => sum + (a.score ?? 0), 0) / submitted.length
      : 0;
  const analytics = await getTestAnalytics(admin, id, test.title);

  const liveTotalMinutes = liveMinutesFromWindow(test.start_time, test.end_time);
  const liveHours = Math.floor(liveTotalMinutes / 60);
  const liveMinutes = liveTotalMinutes % 60;

  const boundUpdateStatus = updateTestStatus.bind(null, id);
  const boundUpdateSettings = updateTestSettings.bind(null, id);
  const boundAddQuestion = addQuestion.bind(null, id);
  const boundDeleteQuestion = deleteQuestion.bind(null, id);
  const boundImportCsv = importQuestionsCsv.bind(null, id);
  const boundResetAttempt = resetAttempt.bind(null, id);
  const boundDisqualify = disqualifyAttempt.bind(null, id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tests" className="btn-text text-xs">
            ← All tests
          </Link>
          <h1 className="text-xl font-semibold mt-1" style={{ color: "var(--ink)" }}>
            {test.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {test.status !== "published" && (
            <form action={async () => { "use server"; await boundUpdateStatus("published"); }}>
              <button className="btn btn-success">Publish</button>
            </form>
          )}
          {test.status === "published" && (
            <form action={async () => { "use server"; await boundUpdateStatus("draft"); }}>
              <button className="btn btn-secondary">Unpublish</button>
            </form>
          )}
          <form action={async () => { "use server"; await boundUpdateStatus("closed"); }}>
            <button className="btn btn-secondary">Close</button>
          </form>
        </div>
      </div>

      {/* Settings */}
      <section className="surface p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)" }}>
          Test settings
        </h2>
        <form action={boundUpdateSettings} className="space-y-4">
          <div>
            <label className="field-label">Title</label>
            <input name="title" defaultValue={test.title} required className="field-input" />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea name="description" defaultValue={test.description ?? ""} rows={2} className="field-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Duration (minutes)</label>
              <input
                name="duration_minutes"
                type="number"
                min={1}
                defaultValue={test.duration_minutes}
                required
                className="field-input"
              />
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                Per student, once they start.
              </p>
            </div>
            <div>
              <label className="field-label">Start time (IST)</label>
              <input
                name="start_time"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(test.start_time)}
                required
                className="field-input"
              />
            </div>
          </div>
          <div>
            <label className="field-label">Live for</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  name="live_hours"
                  type="number"
                  min={0}
                  defaultValue={liveHours}
                  required
                  className="field-input"
                />
                <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                  Hours
                </p>
              </div>
              <div>
                <input
                  name="live_minutes"
                  type="number"
                  min={0}
                  max={59}
                  defaultValue={liveMinutes}
                  required
                  className="field-input"
                />
                <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                  Minutes
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {test.total_marks} total marks · live until{" "}
            {formatInAppTz(test.end_time, { dateStyle: "medium", timeStyle: "short" })} IST
          </p>
          <button className="btn btn-primary">Save settings</button>
        </form>
      </section>

      {/* Questions */}
      <section className="surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Questions ({(questions ?? []).length})
          </h2>
        </div>

        {(questions ?? []).length > 0 && (
          <div className="divider mb-6">
            {(questions ?? []).map((q, i) => (
              <div key={q.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="text-sm flex gap-3">
                  {q.question_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={q.question_image_url}
                      alt=""
                      className="w-14 h-14 object-cover rounded shrink-0"
                      style={{ border: "1px solid var(--rule-strong)" }}
                    />
                  )}
                  <div>
                    <p style={{ color: "var(--ink)" }}>
                      {i + 1}. {q.question_text}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                      Answer: {q.correct_answer} · +{q.marks} / −{q.negative_marks}
                    </p>
                  </div>
                </div>
                <form action={async () => { "use server"; await boundDeleteQuestion(q.id); }}>
                  <button className="btn-danger text-xs shrink-0">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold mb-2 tracking-wide" style={{ color: "var(--ink-soft)" }}>
              Add one question
            </h3>
            <form action={boundAddQuestion} className="space-y-3">
              <input
                name="question_text"
                placeholder="Question text (optional if using an image)"
                className="field-input"
              />
              <div>
                <label className="field-label">Question image (optional)</label>
                <input name="question_image" type="file" accept="image/*" className="field-file" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Option A</label>
                  <input name="option_a_text" placeholder="Text" required className="field-input mb-1.5" />
                  <input name="option_a_image" type="file" accept="image/*" className="field-file" />
                </div>
                <div>
                  <label className="field-label">Option B</label>
                  <input name="option_b_text" placeholder="Text" required className="field-input mb-1.5" />
                  <input name="option_b_image" type="file" accept="image/*" className="field-file" />
                </div>
                <div>
                  <label className="field-label">Option C</label>
                  <input name="option_c_text" placeholder="Text" required className="field-input mb-1.5" />
                  <input name="option_c_image" type="file" accept="image/*" className="field-file" />
                </div>
                <div>
                  <label className="field-label">Option D</label>
                  <input name="option_d_text" placeholder="Text" required className="field-input mb-1.5" />
                  <input name="option_d_image" type="file" accept="image/*" className="field-file" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="field-label">Correct</label>
                  <select name="correct_answer" required className="field-input">
                    <option value="">—</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Marks</label>
                  <input name="marks" type="number" step="0.25" defaultValue={1} className="field-input" />
                </div>
                <div>
                  <label className="field-label">Negative</label>
                  <input name="negative_marks" type="number" step="0.25" defaultValue={0.25} className="field-input" />
                </div>
              </div>

              <button className="btn btn-primary w-full">Add question</button>
            </form>
          </div>

          <div>
            <h3 className="text-xs font-semibold mb-2 tracking-wide" style={{ color: "var(--ink-soft)" }}>
              Bulk import from CSV
            </h3>
            <form action={boundImportCsv} className="space-y-3">
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                Columns: Question, A, B, C, D, Answer, Marks, Negative
              </p>
              <div>
                <label className="field-label">CSV file</label>
                <input name="file" type="file" accept=".csv" required className="field-file" />
              </div>
              <button className="btn btn-secondary w-full">Upload CSV</button>
            </form>
          </div>
        </div>
      </section>

      {/* Analytics */}
      <section className="surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Analytics
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mb-5">
          <div className="rounded p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--rule-strong)" }}>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Attempts</p>
            <p className="text-xl font-semibold mt-1" style={{ color: "var(--ink)" }}>{analytics.total_attempts}</p>
          </div>
          <div className="rounded p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--rule-strong)" }}>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Avg score</p>
            <p className="text-xl font-semibold mt-1" style={{ color: "var(--ink)" }}>{analytics.average_score.toFixed(1)}</p>
          </div>
          <div className="rounded p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--rule-strong)" }}>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Highest</p>
            <p className="text-xl font-semibold mt-1" style={{ color: "var(--ink)" }}>{analytics.highest_score}</p>
          </div>
          <div className="rounded p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--rule-strong)" }}>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Lowest</p>
            <p className="text-xl font-semibold mt-1" style={{ color: "var(--ink)" }}>{analytics.lowest_score}</p>
          </div>
        </div>

        {analytics.top_performer && (
          <p className="text-sm mb-5" style={{ color: "var(--ink-soft)" }}>
            Top performer: <span className="font-semibold" style={{ color: "var(--ink)" }}>{analytics.top_performer.name}</span>{" "}
            <span style={{ color: "var(--ink-faint)" }}>({analytics.top_performer.register_number})</span> — {analytics.top_performer.score} marks
          </p>
        )}

        <div className="divider">
          {analytics.question_stats.map((q) => (
            <div key={q.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <p style={{ color: "var(--ink)" }}>
                  Q{q.order_index}. {q.text}
                </p>
                <span className="badge" style={{
                  background:
                    q.difficulty === "easy"
                      ? "var(--green-soft)"
                      : q.difficulty === "hard"
                        ? "var(--red-soft)"
                        : "#ece8dd",
                  color:
                    q.difficulty === "easy"
                      ? "var(--green)"
                      : q.difficulty === "hard"
                        ? "var(--red)"
                        : "var(--ink-soft)",
                }}>
                  {q.difficulty}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                {q.correct_count} correct · {q.incorrect_count} wrong · {q.unanswered_count} unanswered · {q.accuracy.toFixed(0)}% accuracy
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Results — {submitted.length} attempted, avg {avgScore.toFixed(1)}
          </h2>
          <a href={`/api/admin/tests/${id}/results-csv`} className="btn-text text-xs underline">
            Download CSV
          </a>
        </div>

        {(attempts ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
            No attempts yet.
          </p>
        ) : (
          <div className="divider">
            {attempts.map((a) => (
              <div key={a.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <p style={{ color: "var(--ink)" }}>
                    {a.user?.name}{" "}
                    <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                      ({a.user?.register_number})
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    {a.status}
                    {a.status === "submitted" && ` · Score: ${a.score}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {a.status === "submitted" && (
                    <form action={async () => { "use server"; await boundResetAttempt(a.id); }}>
                      <button className="btn-text text-xs">Reset</button>
                    </form>
                  )}
                  {a.status !== "disqualified" && (
                    <form action={async () => { "use server"; await boundDisqualify(a.id); }}>
                      <button className="btn-danger text-xs">Disqualify</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
