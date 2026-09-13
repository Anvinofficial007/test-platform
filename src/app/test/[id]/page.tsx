"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import type { Question, Test } from "@/lib/data";

type AnswerState = Record<string, string | null>;
type ReviewState = Record<string, boolean>;

const AUTOSAVE_INTERVAL_MS = 5000;

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<"loading" | "instructions" | "running" | "submitting" | "error">(
    "loading"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [marked, setMarked] = useState<ReviewState>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const dirtyRef = useRef(false);

  const storageKey = `attempt:${id}`;

  // Load test + questions (server strips correct answers, per the plan)
  useEffect(() => {
    fetch(`/api/tests/${id}/questions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setPhase("error");
          return;
        }
        setTest(data.test);
        setQuestions(data.questions);
        // Server computes this from the attempt's recorded started_at,
        // so a page refresh or a slow client clock can't extend the test.
        setSecondsLeft(data.secondsLeft);

        // Resume from local backup if present (network-drop resilience, Phase 1 version)
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setAnswers(parsed.answers ?? {});
          setMarked(parsed.marked ?? {});
        }
        setPhase("instructions");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Timer
  useEffect(() => {
    if (phase !== "running") return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  // Auto-save to localStorage periodically instead of on every click,
  // so 300 students clicking "Next" doesn't hammer the network (per the plan).
  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => {
      if (dirtyRef.current) {
        localStorage.setItem(storageKey, JSON.stringify({ answers, marked }));
        dirtyRef.current = false;
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answers, marked]);

  function selectAnswer(qid: string, key: string) {
    setAnswers((a) => ({ ...a, [qid]: key }));
    dirtyRef.current = true;
  }

  function toggleMark(qid: string) {
    setMarked((m) => ({ ...m, [qid]: !m[qid] }));
    dirtyRef.current = true;
  }

  async function handleSubmit() {
    setPhase("submitting");
    localStorage.setItem(storageKey, JSON.stringify({ answers, marked }));

    const res = await fetch(`/api/tests/${id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const result = await res.json();

    if (result.error) {
      setErrorMsg(result.error);
      setPhase("error");
      return;
    }

    sessionStorage.setItem(`result:${id}`, JSON.stringify(result));
    localStorage.removeItem(storageKey);
    router.push(`/result/${id}`);
  }

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v !== null && v !== undefined).length,
    [answers]
  );

  if (phase === "loading") {
    return <main className="min-h-screen flex items-center justify-center text-slate-400">Loading…</main>;
  }

  if (phase === "error" || !test) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <p>{errorMsg || "Something went wrong."}</p>
        <a href="/dashboard" className="text-slate-900 underline text-sm">
          Back to dashboard
        </a>
      </main>
    );
  }

  if (phase === "instructions") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-slate-900">{test.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{test.description}</p>

          <ul className="mt-6 space-y-2 text-sm text-slate-700 list-disc list-inside">
            <li>{questions.length} questions, {test.duration_minutes} minutes</li>
            <li>+1 mark for each correct answer</li>
            <li>−0.25 for each wrong answer, 0 for unanswered</li>
            <li>The timer starts as soon as you click "Start test" and cannot be paused</li>
            <li>Your answers are saved automatically as you go</li>
          </ul>

          <button
            onClick={() => setPhase("running")}
            className="mt-6 w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2 hover:bg-slate-800 transition-colors"
          >
            Start test
          </button>
        </div>
      </main>
    );
  }

  if (phase === "submitting") {
    return <main className="min-h-screen flex items-center justify-center text-slate-400">Submitting…</main>;
  }

  const q = questions[current];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeLow = secondsLeft <= 60;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">
        {/* Question area */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              Question {current + 1} of {questions.length}
            </p>
            <span
              className={`text-sm font-mono font-medium px-3 py-1 rounded-md ${
                timeLow ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              {mins}:{secs.toString().padStart(2, "0")}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <p className="text-slate-900 font-medium mb-4">{q.question_text}</p>
            {q.question_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.question_image_url} alt="Question figure" className="mb-4 rounded-md border" />
            )}

            <div className="space-y-2">
              {q.options.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    answers[q.id] === opt.key
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === opt.key}
                    onChange={() => selectAnswer(q.id, opt.key)}
                    className="accent-slate-900"
                  />
                  <span className="font-medium text-slate-500">{opt.key}.</span>
                  <span>{opt.text}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => toggleMark(q.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
                  marked[q.id]
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {marked[q.id] ? "Marked for review" : "Mark for review"}
              </button>

              {answers[q.id] && (
                <button
                  onClick={() => selectAnswer(q.id, "")}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear answer
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            {current < questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
              >
                Submit test
              </button>
            )}
          </div>
        </div>

        {/* Question palette */}
        <aside className="bg-white border border-slate-200 rounded-lg p-4 h-fit">
          <p className="text-xs text-slate-500 mb-3">
            {answeredCount} of {questions.length} answered
          </p>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((qq, i) => {
              const state = answers[qq.id]
                ? marked[qq.id]
                  ? "answered-marked"
                  : "answered"
                : marked[qq.id]
                ? "marked"
                : "unanswered";
              const styles: Record<string, string> = {
                answered: "bg-emerald-600 text-white",
                "answered-marked": "bg-amber-500 text-white",
                marked: "bg-amber-100 text-amber-700 border border-amber-300",
                unanswered: "bg-slate-100 text-slate-600",
              };
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrent(i)}
                  className={`text-xs font-medium rounded-md h-8 ${styles[state]} ${
                    i === current ? "ring-2 ring-slate-900" : ""
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSubmit}
            className="mt-4 w-full rounded-md bg-slate-900 text-white text-sm py-2 hover:bg-slate-800"
          >
            Submit test
          </button>
        </aside>
      </div>
    </main>
  );
}
