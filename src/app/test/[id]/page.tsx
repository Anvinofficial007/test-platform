"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import type { Question, Test } from "@/lib/data";

type AnswerState = Record<string, string | null>;
type ReviewState = Record<string, boolean>;
type SyncStatus = "synced" | "syncing" | "offline";

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const dirtyRef = useRef(false);
  const submittingRef = useRef(false);

  const storageKey = `attempt:${id}`;

  // Load test + questions (server strips correct answers, per the plan)
  useEffect(() => {
    fetch(`/api/tests/${id}/questions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          // The attempt may have already been auto-finalized (time ran out
          // while this tab, or any tab, was closed) — send them straight
          // to the result instead of showing a dead end.
          if (data.finalized) {
            router.push(`/result/${id}`);
            return;
          }
          setErrorMsg(data.error);
          setPhase("error");
          return;
        }
        setTest(data.test);
        setQuestions(data.questions);
        // Server computes this from the attempt's recorded started_at,
        // so a page refresh or a slow client clock can't extend the test.
        setSecondsLeft(data.secondsLeft);

        // Resume: start from what the DB last had synced (works across
        // devices/browsers), then layer in anything still sitting in this
        // browser's local backup that never made it to the server (e.g. the
        // connection dropped right before the last autosave tick).
        const merged: AnswerState = { ...(data.savedAnswers ?? {}) };
        let restoredMarks: ReviewState = {};
        const localBackup = localStorage.getItem(storageKey);
        if (localBackup) {
          try {
            const parsed = JSON.parse(localBackup);
            Object.assign(merged, parsed.answers ?? {});
            restoredMarks = parsed.marked ?? {};
          } catch {
            // ignore corrupt local backup
          }
        }
        setAnswers(merged);
        setMarked(restoredMarks);
        setPhase("instructions");
      })
      .catch(() => {
        setErrorMsg("Couldn't reach the server. Check your connection and reload.");
        setPhase("error");
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

  // Auto-save periodically (not on every click, so 300 students clicking
  // "Next" doesn't hammer the network, per the plan). Writes to
  // localStorage immediately for offline resilience, and to the DB so
  // progress survives a refresh, a crash, or switching devices.
  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(async () => {
      if (!dirtyRef.current) return;
      localStorage.setItem(storageKey, JSON.stringify({ answers, marked }));
      dirtyRef.current = false;

      setSyncStatus("syncing");
      try {
        const res = await fetch(`/api/tests/${id}/save-answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        if (!res.ok) throw new Error();
        setSyncStatus("synced");
      } catch {
        // Offline or the request failed — the change is still safe in
        // localStorage, and dirtyRef is left true so the next tick retries.
        dirtyRef.current = true;
        setSyncStatus("offline");
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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("submitting");
    localStorage.setItem(storageKey, JSON.stringify({ answers, marked }));

    // The exam-day case this guards against: 300 students submitting near
    // the same second and a few requests time out or drop. Retry a handful
    // of times with a short backoff before giving up — the attempt and
    // answers are idempotent to resend (submit re-scores from the payload,
    // save-answers upserts), so a retry can't double-count anything.
    const MAX_ATTEMPTS = 4;
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`/api/tests/${id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        const result = await res.json();

        if (result.error) {
          // Already submitted (e.g. auto-finalized while this request was
          // in flight) isn't a failure from the student's point of view —
          // just go to the result.
          sessionStorage.removeItem(`result:${id}`);
          localStorage.removeItem(storageKey);
          router.push(`/result/${id}`);
          return;
        }

        sessionStorage.setItem(`result:${id}`, JSON.stringify(result));
        localStorage.removeItem(storageKey);
        router.push(`/result/${id}`);
        return;
      } catch {
        lastError = "Couldn't reach the server to submit.";
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    }

    // All retries failed — surface a retry button rather than losing the
    // attempt. Answers are still safe in localStorage either way.
    submittingRef.current = false;
    setErrorMsg(`${lastError} Your answers are saved — try submitting again.`);
    setPhase("error");
  }

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v !== null && v !== undefined).length,
    [answers]
  );

  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ color: "var(--ink-faint)" }}>
        Loading…
      </main>
    );
  }

  if (phase === "error" || !test) {
    // A submit failure (as opposed to a load failure) still has answers
    // in-memory and in localStorage — offer to retry rather than stranding
    // the student with only "back to dashboard".
    const canRetrySubmit = phase === "error" && test && questions.length > 0;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center" style={{ color: "var(--ink-soft)" }}>
        <p>{errorMsg || "Something went wrong."}</p>
        <div className="flex items-center gap-4">
          {canRetrySubmit && (
            <button onClick={handleSubmit} className="btn btn-primary">
              Retry submit
            </button>
          )}
          <a href="/dashboard" className="btn-text text-sm underline">
            Back to dashboard
          </a>
        </div>
      </main>
    );
  }

  if (phase === "instructions") {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="max-w-xl mx-auto surface p-6">
          <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
            {test.title}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--ink-soft)" }}>
            {test.description}
          </p>

          <ul className="mt-6 space-y-2 text-sm list-disc list-inside" style={{ color: "var(--ink)" }}>
            <li>{questions.length} questions, {test.duration_minutes} minutes</li>
            <li>+1 mark for each correct answer</li>
            <li>−0.25 for each wrong answer, 0 for unanswered</li>
            <li>The timer starts as soon as you click &ldquo;Start test&rdquo; and cannot be paused</li>
            <li>Your answers are saved automatically as you go</li>
          </ul>

          <button onClick={() => setPhase("running")} className="btn btn-primary w-full mt-6">
            Start test
          </button>
        </div>
      </main>
    );
  }

  if (phase === "submitting") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ color: "var(--ink-faint)" }}>
        Submitting…
      </main>
    );
  }

  const q = questions[current];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeLow = secondsLeft <= 60;

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">
        {/* Question area */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Question {current + 1} of {questions.length}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="badge"
                style={
                  syncStatus === "offline"
                    ? { background: "var(--amber-soft)", color: "var(--amber)" }
                    : syncStatus === "syncing"
                    ? { background: "#ece8dd", color: "var(--ink-soft)" }
                    : { background: "transparent", color: "var(--ink-faint)" }
                }
              >
                {syncStatus === "offline" ? "Offline — saved locally" : syncStatus === "syncing" ? "Saving…" : "Saved"}
              </span>
              <span
                className="text-sm font-mono font-semibold px-3 py-1 rounded"
                style={
                  timeLow
                    ? { background: "var(--red-soft)", color: "var(--red)" }
                    : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--rule-strong)" }
                }
              >
                {mins}:{secs.toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="surface p-5">
            <p className="font-medium mb-4" style={{ color: "var(--ink)" }}>
              {q.question_text}
            </p>
            {q.question_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.question_image_url}
                alt="Question figure"
                className="mb-4 rounded"
                style={{ border: "1px solid var(--rule-strong)" }}
              />
            )}

            <div className="space-y-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.key;
                return (
                  <label
                    key={opt.key}
                    className="flex items-center gap-3 rounded px-3 py-2 text-sm cursor-pointer transition-colors"
                    style={
                      selected
                        ? { border: "1px solid var(--navy)", background: "#eef0f8" }
                        : { border: "1px solid var(--rule-strong)", background: "var(--surface)" }
                    }
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      onChange={() => selectAnswer(q.id, opt.key)}
                      style={{ accentColor: "var(--navy)" }}
                    />
                    <span className="font-semibold" style={{ color: "var(--ink-soft)" }}>
                      {opt.key}.
                    </span>
                    <span style={{ color: "var(--ink)" }}>{opt.text}</span>
                    {opt.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opt.image_url}
                        alt={`Option ${opt.key}`}
                        className="h-12 rounded ml-2"
                        style={{ border: "1px solid var(--rule-strong)" }}
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => toggleMark(q.id)}
                className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
                style={
                  marked[q.id]
                    ? { border: "1px solid #d9b25c", background: "var(--amber-soft)", color: "var(--amber)" }
                    : { border: "1px solid var(--rule-strong)", color: "var(--ink-soft)" }
                }
              >
                {marked[q.id] ? "Marked for review" : "Mark for review"}
              </button>

              {answers[q.id] && (
                <button onClick={() => selectAnswer(q.id, "")} className="btn-text text-xs">
                  Clear answer
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              className="btn btn-secondary"
              style={current === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            >
              Previous
            </button>
            {current < questions.length - 1 ? (
              <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} className="btn btn-primary">
                Next
              </button>
            ) : (
              <button onClick={handleSubmit} className="btn btn-success">
                Submit test
              </button>
            )}
          </div>
        </div>

        {/* Question palette */}
        <aside className="surface p-4 h-fit">
          <p className="text-xs mb-3" style={{ color: "var(--ink-faint)" }}>
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
              const styles: Record<string, React.CSSProperties> = {
                answered: { background: "var(--green)", color: "var(--surface)" },
                "answered-marked": { background: "var(--amber)", color: "var(--surface)" },
                marked: { background: "var(--amber-soft)", color: "var(--amber)", border: "1px solid #d9b25c" },
                unanswered: { background: "#ece8dd", color: "var(--ink-soft)" },
              };
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrent(i)}
                  className="text-xs font-medium rounded h-8"
                  style={{
                    ...styles[state],
                    outline: i === current ? "2px solid var(--navy)" : "none",
                    outlineOffset: "1px",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <button onClick={handleSubmit} className="btn btn-primary w-full mt-4">
            Submit test
          </button>
        </aside>
      </div>
    </main>
  );
}
