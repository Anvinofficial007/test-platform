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
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-500">
        <p>No result found for this test.</p>
        <Link href="/dashboard" className="text-slate-900 underline text-sm">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const percent = result.total_marks > 0 ? (result.score / result.total_marks) * 100 : 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-sm text-slate-500">Your score</p>
          <p className="text-4xl font-semibold text-slate-900 mt-1">
            {result.score} <span className="text-lg text-slate-400">/ {result.total_marks}</span>
          </p>
          <p className="text-sm text-slate-500 mt-1">{percent.toFixed(1)}%</p>

          <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
            <div className="rounded-md bg-emerald-50 text-emerald-700 py-3">
              <p className="text-lg font-semibold">{result.correct_count}</p>
              <p className="text-xs">Correct</p>
            </div>
            <div className="rounded-md bg-red-50 text-red-700 py-3">
              <p className="text-lg font-semibold">{result.wrong_count}</p>
              <p className="text-xs">Wrong</p>
            </div>
            <div className="rounded-md bg-slate-100 text-slate-600 py-3">
              <p className="text-lg font-semibold">{result.unanswered_count}</p>
              <p className="text-xs">Unanswered</p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {result.breakdown.map((b, i) => (
            <div key={b.question_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-600">Q{i + 1}</span>
              <span className="text-slate-500">
                Your answer: <span className="font-medium">{b.selected ?? "—"}</span>
              </span>
              <span className="text-slate-500">
                Correct: <span className="font-medium">{b.correct}</span>
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                  b.is_correct
                    ? "bg-emerald-100 text-emerald-700"
                    : b.selected
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {b.marks_awarded > 0 ? `+${b.marks_awarded}` : b.marks_awarded}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/dashboard"
          className="mt-6 block text-center rounded-md bg-slate-900 text-white text-sm py-2 hover:bg-slate-800"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
