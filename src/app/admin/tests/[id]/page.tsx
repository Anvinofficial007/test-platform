import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addQuestion,
  deleteQuestion,
  disqualifyAttempt,
  importQuestionsCsv,
  resetAttempt,
  updateTestSettings,
  updateTestStatus,
} from "@/app/admin/actions";

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

  const userIds = [...new Set((attemptsRaw ?? []).map((a) => a.user_id))];
  const { data: attemptUsers } = userIds.length
    ? await admin.from("users").select("id, name, register_number").in("id", userIds)
    : { data: [] };
  const userById = new Map((attemptUsers ?? []).map((u) => [u.id, u]));
  const attempts = (attemptsRaw ?? []).map((a) => ({ ...a, user: userById.get(a.user_id) }));

  const submitted = attempts.filter((a) => a.status === "submitted");
  const avgScore =
    submitted.length > 0
      ? submitted.reduce((sum, a) => sum + (a.score ?? 0), 0) / submitted.length
      : 0;

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
          <Link href="/admin/tests" className="text-xs text-slate-400 hover:text-slate-700">
            ← All tests
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-1">{test.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {test.status !== "published" && (
            <form action={async () => { "use server"; await boundUpdateStatus("published"); }}>
              <button className="rounded-md bg-emerald-600 text-white text-sm px-4 py-2 hover:bg-emerald-700">
                Publish
              </button>
            </form>
          )}
          {test.status === "published" && (
            <form action={async () => { "use server"; await boundUpdateStatus("draft"); }}>
              <button className="rounded-md border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50">
                Unpublish
              </button>
            </form>
          )}
          <form action={async () => { "use server"; await boundUpdateStatus("closed"); }}>
            <button className="rounded-md border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50">
              Close
            </button>
          </form>
        </div>
      </div>

      {/* Settings */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Test settings</h2>
        <form action={boundUpdateSettings} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input
              name="title"
              defaultValue={test.title}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea
              name="description"
              defaultValue={test.description ?? ""}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Duration (minutes)</label>
              <input
                name="duration_minutes"
                type="number"
                min={1}
                defaultValue={test.duration_minutes}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start time</label>
              <input
                name="start_time"
                type="datetime-local"
                defaultValue={toLocalInputValue(test.start_time)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {test.total_marks} total marks · ends {new Date(test.end_time).toLocaleString(undefined, { timeStyle: "short" })}
          </p>
          <button className="rounded-md bg-slate-900 text-white text-sm px-4 py-2 hover:bg-slate-800">
            Save settings
          </button>
        </form>
      </section>

      {/* Questions */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-slate-700">
            Questions ({(questions ?? []).length})
          </h2>
        </div>

        {(questions ?? []).length > 0 && (
          <div className="divide-y divide-slate-100 mb-6">
            {(questions ?? []).map((q, i) => (
              <div key={q.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="text-sm flex gap-3">
                  {q.question_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.question_image_url} alt="" className="w-14 h-14 object-cover rounded border border-slate-200 shrink-0" />
                  )}
                  <div>
                    <p className="text-slate-900">
                      {i + 1}. {q.question_text}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Answer: {q.correct_answer} · +{q.marks} / −{q.negative_marks}
                    </p>
                  </div>
                </div>
                <form action={async () => { "use server"; await boundDeleteQuestion(q.id); }}>
                  <button className="text-xs text-red-500 hover:text-red-700 shrink-0">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Add one question
            </h3>
            <form action={boundAddQuestion} className="space-y-2">
              <input
                name="question_text"
                placeholder="Question text (optional if using an image)"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <div>
                <label className="block text-xs text-slate-500 mb-1">Question image (optional)</label>
                <input name="question_image" type="file" accept="image/*" className="w-full text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input name="option_a_text" placeholder="Option A" required className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm mb-1" />
                  <input name="option_a_image" type="file" accept="image/*" className="w-full text-xs" />
                </div>
                <div>
                  <input name="option_b_text" placeholder="Option B" required className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm mb-1" />
                  <input name="option_b_image" type="file" accept="image/*" className="w-full text-xs" />
                </div>
                <div>
                  <input name="option_c_text" placeholder="Option C" required className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm mb-1" />
                  <input name="option_c_image" type="file" accept="image/*" className="w-full text-xs" />
                </div>
                <div>
                  <input name="option_d_text" placeholder="Option D" required className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm mb-1" />
                  <input name="option_d_image" type="file" accept="image/*" className="w-full text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select name="correct_answer" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                  <option value="">Correct</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
                <input name="marks" type="number" step="0.25" defaultValue={1} placeholder="Marks" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                <input name="negative_marks" type="number" step="0.25" defaultValue={0.25} placeholder="Negative" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
              </div>
              <button className="w-full rounded-md bg-slate-900 text-white text-sm py-1.5 hover:bg-slate-800">
                Add question
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Bulk import from CSV
            </h3>
            <form action={boundImportCsv} className="space-y-2">
              <p className="text-xs text-slate-400">
                Columns: Question, A, B, C, D, Answer, Marks, Negative
              </p>
              <input
                name="file"
                type="file"
                accept=".csv"
                required
                className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5"
              />
              <button className="w-full rounded-md border border-slate-300 text-slate-700 text-sm py-1.5 hover:bg-slate-50">
                Upload CSV
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-slate-700">
            Results — {submitted.length} attempted, avg {avgScore.toFixed(1)}
          </h2>
          <a
            href={`/api/admin/tests/${id}/results-csv`}
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            Download CSV
          </a>
        </div>

        {(attempts ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No attempts yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {attempts.map((a) => (
              <div key={a.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <p className="text-slate-900">
                    {a.user?.name}{" "}
                    <span className="text-xs text-slate-400">({a.user?.register_number})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.status}
                    {a.status === "submitted" && ` · Score: ${a.score}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {a.status === "submitted" && (
                    <form action={async () => { "use server"; await boundResetAttempt(a.id); }}>
                      <button className="text-xs text-slate-500 hover:text-slate-900">Reset</button>
                    </form>
                  )}
                  {a.status !== "disqualified" && (
                    <form action={async () => { "use server"; await boundDisqualify(a.id); }}>
                      <button className="text-xs text-red-500 hover:text-red-700">Disqualify</button>
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
