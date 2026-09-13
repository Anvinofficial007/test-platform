-- Weekly Test Platform — Phase 2 schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run

-- ─────────────────────────────────────────────────────────────
-- users (mirrors auth.users; role is what our RLS policies key off)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  register_number text unique not null,
  email text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- tests
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_minutes int not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  total_marks numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- questions (image fields per the plan's image/diagram handling)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_text text not null,
  question_image_url text,
  option_a_text text not null,
  option_a_image_url text,
  option_b_text text not null,
  option_b_image_url text,
  option_c_text text not null,
  option_c_image_url text,
  option_d_text text not null,
  option_d_image_url text,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  marks numeric not null default 1,
  negative_marks numeric not null default 0,
  order_index int not null default 0
);

-- ─────────────────────────────────────────────────────────────
-- attempts (one per student per test; started_at drives server-side
-- expiry checks so a late submit can't be scored)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired', 'disqualified')),
  unique (test_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- answers
-- ─────────────────────────────────────────────────────────────
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_answer text check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  marks_awarded numeric,
  unique (attempt_id, question_id)
);

create index if not exists idx_questions_test_id on public.questions(test_id);
create index if not exists idx_attempts_test_id on public.attempts(test_id);
create index if not exists idx_attempts_user_id on public.attempts(user_id);
create index if not exists idx_answers_attempt_id on public.answers(attempt_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- Students: can read/write only their own data, never see correct_answer.
-- Admins: full access.
-- We enforce "never expose correct_answer" by NOT selecting it from
-- the client — the app always reads questions through the server
-- (API routes using the service role key), never via the anon key
-- directly from the browser. RLS below is the DB-level backstop.
-- ─────────────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;

drop policy if exists "Users can read own row" on public.users;
create policy "Users can read own row" on public.users
  for select using (auth.uid() = id);

drop policy if exists "Users can create their own profile row" on public.users;
create policy "Users can create their own profile row" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "Published tests are readable by authenticated users" on public.tests;
create policy "Published tests are readable by authenticated users" on public.tests
  for select using (status = 'published' and auth.role() = 'authenticated');

-- No direct client policy on questions: only the server (service role)
-- reads this table, so it always strips correct_answer before responding.

drop policy if exists "Students manage their own attempts" on public.attempts;
create policy "Students manage their own attempts" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Students manage answers on their own attempts" on public.answers;
create policy "Students manage answers on their own attempts" on public.answers
  for all using (
    exists (
      select 1 from public.attempts
      where attempts.id = answers.attempt_id
      and attempts.user_id = auth.uid()
    )
  );

-- Admin read access for the /admin panel. Writes for admins go through the
-- service-role client in src/lib/supabase/adminGuard.ts (which checks the
-- role itself), so these are read-only SELECT policies for the anon-key
-- client used in admin Server Components (e.g. listing all attempts).
-- Security-definer helper avoids RLS self-recursion when a policy on
-- public.users needs to check the current user's own role.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Admins can read all users" on public.users;
create policy "Admins can read all users" on public.users
  for select using (public.is_admin());

drop policy if exists "Admins can read all attempts" on public.attempts;
create policy "Admins can read all attempts" on public.attempts
  for select using (public.is_admin());

drop policy if exists "Admins can read all answers" on public.answers;
create policy "Admins can read all answers" on public.answers
  for select using (public.is_admin());

-- To make your own account an admin after signing up, run in the SQL editor:
--   update public.users set role = 'admin' where register_number = 'YOUR_REG_NO';

-- ─────────────────────────────────────────────────────────────
-- Storage bucket for question/option images (Phase 3 image upload).
-- Public bucket: anyone with the URL can view an image (fine for exam
-- figures/diagrams), but only the server's service-role client — used
-- exclusively inside admin server actions, after requireAdmin() checks
-- the caller's role — can upload or delete objects in it.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "Question images are publicly readable" on storage.objects;
create policy "Question images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'question-images');

-- Uploads only ever happen server-side through the service-role client
-- (see addQuestion in src/app/admin/actions.ts), which bypasses these
-- policies entirely — so no insert/update/delete policy is needed here
-- for the browser. This keeps "only admins can add images" enforced by
-- the same requireAdmin() check as everything else in the admin panel,
-- rather than duplicating that logic in a storage policy.

-- ─────────────────────────────────────────────────────────────
-- Seed data — same demo test/questions as the Phase 1 hardcoded version,
-- so you can see the UI working immediately. Safe to delete later from
-- the admin panel once you add real tests.
-- ─────────────────────────────────────────────────────────────
insert into public.tests (id, title, description, duration_minutes, start_time, end_time, total_marks, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'Weekly Test #12 — Aptitude & Digital Electronics',
  '50 questions covering quantitative aptitude and digital logic design.',
  60,
  now() - interval '5 minutes',
  now() + interval '1 day',
  5,
  'published'
)
on conflict (id) do nothing;

insert into public.questions (test_id, question_text, option_a_text, option_b_text, option_c_text, option_d_text, correct_answer, marks, negative_marks, order_index)
values
  ('11111111-1111-1111-1111-111111111111', 'A train 150 m long crosses a pole in 15 seconds. What is its speed in km/h?', '30 km/h', '36 km/h', '45 km/h', '50 km/h', 'B', 1, 0.25, 1),
  ('11111111-1111-1111-1111-111111111111', 'Simplify the Boolean expression: A + A·B', 'A', 'B', 'A·B', 'A + B', 'A', 1, 0.25, 2),
  ('11111111-1111-1111-1111-111111111111', 'If the cost price of an item is ₹80 and it is sold at a 25% profit, what is the selling price?', '₹95', '₹100', '₹105', '₹110', 'B', 1, 0.25, 3),
  ('11111111-1111-1111-1111-111111111111', 'Which flip-flop is also known as the ''universal'' flip-flop?', 'SR flip-flop', 'D flip-flop', 'JK flip-flop', 'T flip-flop', 'C', 1, 0.25, 4),
  ('11111111-1111-1111-1111-111111111111', 'Find the next number in the series: 2, 6, 12, 20, 30, ?', '36', '40', '42', '44', 'C', 1, 0.25, 5)
on conflict do nothing;
