"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import type { ScoreResult } from "@/lib/data";

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<ScoreResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`result:${id}`);
    if (raw) {
      setResult(JSON.parse(raw));
      return;
    }
    // Fell here via a fresh page load (dashboard link, refresh) rather than
    // straight from submit — reconstruct the result from the DB instead.
    fetch(`/api/tests/${id}/result`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setResult(data);
      });
  }, [id]);

  if (!result) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ color: "var(--ink-soft)" }}>
        <p>No result found for this test.</p>
        <Link href="/dashboard" className="btn-text text-sm underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const percent = result.total_marks > 0 ? (result.score / result.total_marks) * 100 : 0;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-xl mx-auto">
        <div className="surface p-6 text-center">
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Your score
          </p>
          <p className="text-4xl font-semibold mt-1" style={{ color: "var(--ink)" }}>
            {result.score}{" "}
            <span className="text-lg" style={{ color: "var(--ink-faint)" }}>
              / {result.total_marks}
            </span>
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            {percent.toFixed(1)}%
          </p>

          <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
            <div className="rounded py-3" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
              <p className="text-lg font-semibold">{result.correct_count}</p>
              <p className="text-xs">Correct</p>
            </div>
            <div className="rounded py-3" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
              <p className="text-lg font-semibold">{result.wrong_count}</p>
              <p className="text-xs">Wrong</p>
            </div>
            <div className="rounded py-3" style={{ background: "#ece8dd", color: "var(--ink-soft)" }}>
              <p className="text-lg font-semibold">{result.unanswered_count}</p>
              <p className="text-xs">Unanswered</p>
            </div>
          </div>
        </div>

        <div className="mt-6 surface divider">
          {result.breakdown.map((b, i) => (
            <div
              key={b.question_id}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <span style={{ color: "var(--ink-soft)" }}>Q{i + 1}</span>
              <span style={{ color: "var(--ink-soft)" }}>
                Your answer: <span className="font-medium" style={{ color: "var(--ink)" }}>{b.selected ?? "—"}</span>
              </span>
              <span style={{ color: "var(--ink-soft)" }}>
                Correct: <span className="font-medium" style={{ color: "var(--ink)" }}>{b.correct}</span>
              </span>
              <span
                className="badge"
                style={
                  b.is_correct
                    ? { background: "var(--green-soft)", color: "var(--green)" }
                    : b.selected
                    ? { background: "var(--red-soft)", color: "var(--red)" }
                    : { background: "#ece8dd", color: "var(--ink-soft)" }
                }
              >
                {b.marks_awarded > 0 ? `+${b.marks_awarded}` : b.marks_awarded}
              </span>
            </div>
          ))}
        </div>

        <Link href="/dashboard" className="btn btn-primary w-full mt-6" style={{ display: "flex" }}>
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
