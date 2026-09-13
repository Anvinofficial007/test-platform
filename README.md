# Weekly Test Platform

## Setup

1. Create a free project at https://supabase.com
2. In the Supabase dashboard → SQL Editor, paste and run `supabase/schema.sql`
   (creates tables, RLS policies, and a demo test with 5 seed questions)
3. Copy `.env.local.example` to `.env.local` and fill in the three values
   from Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-only)
4. `npm install`
5. `npm run dev`, visit `localhost:3000`
6. Click "New here? Create an account" to sign up as a student, then
   sign in — the seeded "Weekly Test #12" will show under Active tests.

## What changed from Phase 1

- All hardcoded data in `src/lib/data.ts` replaced by real Supabase tables
  (`supabase/schema.sql`), matching the schema from the dev plan.
- Real auth (Supabase email/password) replaces the mock login.
- `/api/tests/[id]/questions` now creates a real `attempts` row on start,
  and computes remaining time from the DB's `started_at` — not the
  client clock — so a refresh can't extend the timer.
- `/api/tests/[id]/submit` scores server-side using the service-role
  client (the only place `correct_answer` is ever read), writes `answers`
  rows, and marks the attempt `submitted`.
- Row Level Security: students can only read/write their own `attempts`
  and `answers`; the `questions` table has no client-facing policy at
  all, so `correct_answer` can only ever be read via the server's
  service-role key — never directly from the browser.
- Dashboard now reads real test/attempt data, shows "Resume test" vs
  "Start test", and lets you view past results.

## What changed from Phase 2 — admin panel (Phase 3)

- `/admin/tests` — list every test with its status
- `/admin/tests/new` — create a test (saved as `draft`); end time is
  calculated from start time + duration automatically
- `/admin/tests/[id]` — the main admin screen:
  - edit test settings
  - publish / unpublish / close the test
  - add questions one at a time, or bulk-import via CSV (columns:
    `Question, A, B, C, D, Answer, Marks, Negative` — matches the format
    in the dev plan); total marks recalculates automatically
  - delete a question
  - see every student's attempt status and score, reset an attempt
    (clears their answers so they can retake it), or disqualify one
  - download all results as CSV
- All admin writes go through `src/app/admin/actions.ts` (Next.js Server
  Actions). Every action calls `requireAdmin()` first
  (`src/lib/supabase/adminGuard.ts`), which checks the signed-in user's
  `role` in `public.users` before touching the service-role client — so
  admin power only ever activates for accounts you've explicitly marked
  as admin.

### Image uploads (question & option figures)

The "Add one question" form on `/admin/tests/[id]` now has an optional
file picker next to the question text and each of the four options —
for circuit diagrams, waveforms, graphs, or anything from the plan's
"questions with images" section. A question can have text, an image, or
both; each option still needs text (an image can supplement it, not
replace it, since students need something to click).

Uploaded files go to a public Supabase Storage bucket called
`question-images` (created by `supabase/schema.sql`) — only the admin
server actions can upload to it, but anyone with the resulting URL can
view the image, which is what lets it render in the student's browser.
The CSV bulk-import path doesn't support images (there's no column for
a file in a spreadsheet) — use the single-question form for anything
with a figure.

### Making yourself an admin

There's no signup flow for admins on purpose. After creating your normal
student account once, promote it in the Supabase SQL editor:

```sql
update public.users set role = 'admin' where register_number = 'YOUR_REG_NO';
```

Then sign out and back in — an "Admin panel" link appears on the
dashboard.

## Phase 4 — reliability

- **Answers now sync to the DB, not just localStorage.** A new
  `/api/tests/[id]/save-answers` endpoint runs on the same 5-second
  autosave tick as before, upserting into the `answers` table. On load,
  `/api/tests/[id]/questions` returns whatever's already saved for that
  attempt (`savedAnswers`), and the client merges that with any local
  backup that hasn't synced yet. Refreshing the page, closing the tab and
  reopening it, or even switching devices now resumes with the same
  answers — not just the same timer.
- **Auto-submission when time runs out, even if the tab is closed.**
  There's no always-on background process (this is a serverless
  Next.js app), so instead `src/lib/scoring.ts` exports
  `finalizeIfExpired()`, which is called on every path that touches an
  attempt: loading the test page, loading the result page, and the admin
  results view. If an attempt is still `in_progress` but its time window
  has passed, it's scored right there from whatever was last synced to
  the DB and marked `submitted` — so the next time *anyone* looks (the
  student reopening the tab, or an admin checking results), it's closed
  out correctly. If your hosting plan supports scheduled functions, you
  could additionally point a cron job at a sweep endpoint to close out
  attempts within seconds of expiry rather than waiting for the next
  visit — not included here to keep the stack free-tier-friendly.
- **Duplicate-attempt races are handled, not just prevented.** The DB's
  unique `(test_id, user_id)` constraint on `attempts` already stopped a
  second row from being created; now if two concurrent requests both try
  to create the first attempt (e.g. a double page load), the loser
  catches the unique-violation error and re-fetches the winner's row
  instead of failing.
- **Submit retries automatically.** If the submit request fails (dropped
  connection, timeout under load), the client retries a few times with a
  short backoff before giving up — submitting is safe to retry since
  scoring is recomputed fresh from the payload each time. If all retries
  fail, a "Retry submit" button appears; answers stay safe in
  localStorage either way.
- A small **sync status indicator** ("Saved" / "Saving…" / "Offline —
  saved locally") now shows next to the timer during the test.

### What's still open after Phase 4

- Auto-finalization is *lazy* (triggered by the next page load that
  touches the attempt), not instant. For truly immediate cutoff at the
  exact second time runs out regardless of whether anyone reopens a
  page, you'd need a scheduled job — see the note above.
- No offline-first queueing beyond localStorage + retry; a student who's
  fully offline for the entire test duration (never able to reach
  `/api/tests/[id]/questions` even once) can't start the attempt at all
  yet.

## Next: Phase 5 (analytics)

Not built yet: per-question difficulty stats, average time per question,
performance trends across weeks, aptitude vs technical breakdowns.
