// Shared client-facing types for the test-taking flow. Phase 1's hardcoded
// data and scoring logic have moved into the Supabase-backed API routes
// (src/app/api/tests/[id]/...); these types describe the shapes those
// routes return, and are kept here so pages don't need to redeclare them.

export type Question = {
  id: string;
  question_text: string;
  question_image_url?: string | null;
  options: { key: "A" | "B" | "C" | "D"; text: string; image_url?: string }[];
  marks: number;
  negative_marks: number;
};

export type Test = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  total_marks: number;
  status: "draft" | "published" | "closed";
};

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
