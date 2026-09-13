# Weekly Aptitude & Technical Test Website --- Development Plan

## Progress log

**Phase 1 — MVP (done)**
Next.js app scaffolded. Hardcoded data standing in for the DB. Full
student flow working end-to-end: login (mock) → dashboard → test
instructions → MCQs with timer, question palette, mark-for-review,
next/prev → submit → result with score breakdown. Server-side scoring
from day one; correct answers never sent to the browser.

**Phase 2 — Supabase database (done)**
Hardcoded data replaced with real Supabase tables (`users`, `tests`,
`questions`, `attempts`, `answers` — matches the schema below). Real
auth (Supabase email/password, register number captured at signup).
Row Level Security: students can only read/write their own attempts and
answers; `questions` has no client-facing policy at all — only the
server's service-role key can ever read `correct_answer`. Timer is
computed from the DB's recorded `started_at`, not the browser clock.

**Phase 3 — Admin panel (done)**
`/admin` section, gated by a `role` column checked server-side on every
action (`requireAdmin()` guard). Create/edit tests, publish/unpublish/
close, add questions one at a time or bulk-import via CSV
(`Question, A, B, C, D, Answer, Marks, Negative` — exactly the format
below), delete questions, view every student's attempt + score, reset
or disqualify an attempt, download results as CSV. Image upload added
afterward: question and option images go to a public Supabase Storage
bucket (`question-images`), uploaded only through admin server actions.

**Phase 4 — Reliability (done)**
Answers now sync to the DB every 5 seconds during a test (not just
localStorage), so a refresh, a closed tab, or a different device
resumes correctly. Auto-submission when time runs out even if the tab
is closed — enforced lazily: any page that touches an attempt
(test page, result page, admin view) finalizes it if its time window
has passed and it's still `in_progress`. Duplicate-attempt races
handled (concurrent requests can't create two attempt rows). Submit
retries automatically a few times on a dropped connection before
surfacing a manual retry button.

**Since then, done outside the phase plan:**
- Fixed a Postgres trigger conflict that was blocking signup
  ("Database error saving new user")
- Fixed form text being nearly invisible in dark-mode browsers
- IST time handling — admin start-time inputs and all displayed times
  are explicit `Asia/Kolkata`, regardless of server timezone
  (`src/lib/time.ts`)
- Replaced the fixed "duration = active window" assumption with an
  explicit **live-for (hours/minutes)** field, separate from the
  per-student duration — a test can now stay open for admission longer
  than any one student's allotted time
- Visual restyle (paper/navy/amber palette, proper dropzone-styled
  image upload controls, consistent buttons/badges/cards across every
  page) — no logic changes

**Not started yet:**
- Phase 5 — analytics (per-question difficulty, average/highest/lowest
  score, performance trends across weeks, aptitude vs technical
  breakdowns)
- True instant-at-the-second auto-submit (current version closes out
  an expired attempt the next time any page touches it, not via a
  background scheduler)
- Offline-first test *starting* (a student who can't reach the server
  even once can't begin an attempt)

---

## 1. First decide the features

For your weekly tests, start with an MVP.

### Student side

-   Student login
-   Student profile / register number
-   Upcoming tests
-   Test instructions
-   Start test
-   MCQ questions
-   Timer
-   Next / Previous
-   Mark for review
-   Question palette
-   Auto-save answers
-   Submit test
-   Result
-   Score + correct/wrong answers
-   Rank/leaderboard, if needed

### Admin side

Create a separate `/admin` section where you can:

-   Create a test
-   Add/import questions
-   Set duration
-   Set test availability time
-   Set marks
-   Set negative marking
-   Publish/unpublish test
-   View students who attempted
-   View scores
-   Download results as Excel/CSV
-   View leaderboard
-   Reset/disqualify an attempt if necessary

------------------------------------------------------------------------

## 2. Choose a simple technology stack

Recommended stack:

``` text
Frontend + Backend
        ↓
     Next.js
        ↓
      Vercel
        ↓
    Supabase
 ┌──────┴──────┐
 │             │
Database      Auth
PostgreSQL
```

### Why this stack?

**Next.js** - Website + server-side functionality - Good for building
the whole application - Easy deployment to Vercel

**Vercel** - Hosts the website - Handles traffic/CDN/serverless
functions

**Supabase** - PostgreSQL database - Authentication - Useful dashboard -
Easy to work with

For 200--300 students, this is more than enough.

------------------------------------------------------------------------

## 3. Design the database before coding

This is one of the most important parts.

A basic structure could be:

``` text
users
 ├── id
 ├── name
 ├── register_number
 ├── email
 └── role

tests
 ├── id
 ├── title
 ├── description
 ├── duration
 ├── start_time
 ├── end_time
 ├── total_marks
 └── status

questions
 ├── id
 ├── test_id
 ├── question
 ├── option_a
 ├── option_b
 ├── option_c
 ├── option_d
 ├── correct_answer
 ├── marks
 └── negative_marks

attempts
 ├── id
 ├── test_id
 ├── user_id
 ├── started_at
 ├── submitted_at
 ├── score
 └── status

answers
 ├── id
 ├── attempt_id
 ├── question_id
 └── selected_answer
```

The relationship is:

``` text
Student
   │
   ▼
Attempt ─────── Test
   │              │
   ▼              ▼
Answers       Questions
```

------------------------------------------------------------------------

## 4. Handle questions containing images and diagrams

Some aptitude and technical questions may contain:

- Circuit diagrams
- Graphs
- Waveforms
- Flowcharts
- Tables
- Engineering figures
- Equations and formulas
- Images as answer options

For the initial version, **do not add MathJax/KaTeX support unless it becomes necessary**. If a question contains complicated mathematical notation or an equation, simply upload that portion as an image.

A question can contain:

```text
Question
 ├── Text
 └── Image (optional)

Option A
 ├── Text (optional)
 └── Image (optional)

Option B
 ├── Text (optional)
 └── Image (optional)

Option C
 ├── Text (optional)
 └── Image (optional)

Option D
 ├── Text (optional)
 └── Image (optional)
```

A corresponding database structure could be:

```text
questions
 ├── id
 ├── test_id
 ├── question_text
 ├── question_image_url
 │
 ├── option_a_text
 ├── option_a_image_url
 ├── option_b_text
 ├── option_b_image_url
 ├── option_c_text
 ├── option_c_image_url
 ├── option_d_text
 ├── option_d_image_url
 │
 ├── correct_answer
 ├── marks
 └── negative_marks
```

All image fields are optional.

### Image storage

Do not store the actual image files inside PostgreSQL. Store them in **Supabase Storage** and save their paths/URLs in the database.

```text
                    Supabase
              ┌──────────────────┐
              │   PostgreSQL     │
              │                  │
              │ question_text    │
              │ question_image ──┼─────┐
              └──────────────────┘     │
                                       ↓
                              Supabase Storage
                              ┌──────────────┐
                              │ question.png │
                              │ circuit.jpg  │
                              │ diagram.png  │
                              └──────────────┘
```

This allows text-only, image-only, text + image, and image-based option questions.

The admin interface should eventually provide an **Upload Image** button for questions and each option.

---

## 4. Think carefully about the test flow

Example test:

-   50 questions
-   60 minutes
-   +1 for correct
-   −0.25 for wrong
-   0 for unanswered

The flow should be:

``` text
Login
  ↓
Dashboard
  ↓
Weekly Test #12
  ↓
Instructions
  ↓
Start Test
  ↓
Create Attempt in DB
  ↓
Load Questions
  ↓
Timer starts
  ↓
Student answers
  ↓
Answers auto-saved
  ↓
Submit
  ↓
Server calculates score
  ↓
Result
```

### Important

Do not trust the student's browser to calculate the final score.

The server should determine:

-   Whether the test is available
-   Whether the student has already attempted it
-   Whether the attempt has expired
-   Final score
-   Correct answers
-   Negative marking

This prevents easy manipulation.

------------------------------------------------------------------------

## 14. Handle the 300 students starting together

Imagine 300 students click **START TEST** at exactly 10:00 AM.

You don't want every action to repeatedly query the database.

### Before the test

Questions are already stored in Supabase.

### When the student starts

Create an attempt record:

``` text
attempt_id
user_id
test_id
started_at
```

### During the test

Save answers efficiently.

For example:

``` text
Question 1 → A
Question 2 → C
Question 3 → unanswered
Question 4 → D
```

Don't necessarily make a database request every time the student clicks
**Next**.

Keep answers in browser state and periodically save them.

``` text
Student
   ↓
Answer locally
   ↓
Auto-save every few seconds / on changes
   ↓
Supabase
```

This reduces unnecessary requests.

------------------------------------------------------------------------

## 6. Make the test resilient

This is very important for an actual college test.

If a student has answered 30 questions and their Wi-Fi disconnects,
their answers should not disappear.

### Save answers periodically

Also use browser storage as a temporary backup:

``` text
                    Student answers
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
       Browser storage           Supabase
        (temporary)              (server)
```

If the connection drops, the UI can continue showing locally stored
answers and synchronize them when the connection returns.

------------------------------------------------------------------------

## 7. Don't expose the answers

Do not send the correct answer to the student's browser.

Avoid sending data like:

``` text
Question
Option A
Option B
Option C
Option D
Correct answer = B
```

Instead, student-side data should contain only:

``` json
{
  "question": "...",
  "options": ["...", "...", "...", "..."]
}
```

The correct answer should remain protected server-side.

------------------------------------------------------------------------

## 8. Build the admin panel early

Build the admin functionality before spending too much time making the
student interface visually polished.

The weekly workflow should eventually be:

``` text
Admin logs in
      ↓
Create Test
      ↓
Upload 50 questions
      ↓
Set:
  Duration = 60 min
  Date = Sunday
  Time = 10 AM
  Negative = -0.25
      ↓
Publish
      ↓
Students write test
      ↓
Automatic evaluation
      ↓
Admin sees results
```

### Question upload via Excel/CSV

Instead of manually entering 50 questions every week, use an Excel/CSV
format such as:

  Question   A     B     C     D     Answer   Marks   Negative
  ---------- ----- ----- ----- ----- -------- ------- ----------
  2+2 = ?    2     3     4     5     C        1       0.25
  ...        ...   ...   ...   ...   ...      ...     ...

Then:

``` text
Admin → Upload CSV → Validate → Import questions
```

This will save significant time after several weeks.

------------------------------------------------------------------------

## 9. Plan the website pages

A basic structure:

``` text
/
├── Login
│
├── /dashboard
│   ├── Upcoming Tests
│   ├── Active Tests
│   └── Previous Results
│
├── /test/[id]
│   ├── Instructions
│   └── Exam Interface
│
├── /result/[id]
│
└── /admin
    ├── Dashboard
    ├── Tests
    ├── Create Test
    ├── Questions
    ├── Students
    └── Results
```

------------------------------------------------------------------------

## 10. Development order

Don't try to build everything at once.

### Phase 1 --- Basic website

Build:

-   Login
-   Dashboard
-   Test listing
-   Test page
-   Basic questions
-   Timer
-   Submit
-   Result

Get **one test working end-to-end**.

### Phase 2 --- Database

Move everything from hardcoded data to Supabase:

-   Users
-   Tests
-   Questions
-   Attempts
-   Answers
-   Results

### Phase 3 --- Admin panel

Add:

-   Create test
-   Add questions
-   Edit questions
-   Delete questions
-   Publish test
-   View attempts
-   View results

### Phase 4 --- Reliability

Add:

-   Auto-save
-   Resume after refresh
-   Network failure handling
-   Automatic submission
-   Server-side timer validation
-   Duplicate-attempt prevention

### Phase 5 --- Analytics

Add features such as:

``` text
Test #15

Average score       61%
Highest score       94%
Lowest score        18%

Question analysis

Q1   92% correct
Q2   61% correct
Q3   23% correct  ← difficult
Q4   87% correct
```

You could eventually identify:

-   Weak topics
-   Average time/question
-   Difficult questions
-   Student performance over weeks
-   Aptitude vs technical performance

------------------------------------------------------------------------

## 11. Weekly operation after the system is built

Once everything is working, the weekly workload should become small.

### Monday--Thursday

Prepare questions.

### Friday

Upload the test:

``` text
Aptitude Test #18
50 questions
60 minutes
```

### Saturday

Publish the test.

### Sunday 10 AM

``` text
300 students
       ↓
Write test
       ↓
Automatic evaluation
       ↓
Results
```

### Sunday evening

Admin dashboard:

``` text
Students attempted: 287/300

Average: 64.2%

Top 10
────────────
1. Student A   48
2. Student B   47
3. Student C   46
...
```

Then repeat for the next test.

------------------------------------------------------------------------

## 12. Recommended approach

Don't start by worrying about Vercel pricing.

First build the system so that it can handle:

> **300 students simultaneously + 50--100 questions + 60-minute test +
> automatic evaluation.**

Then load-test it with simulated users.

Your architecture matters more than whether you are initially on Vercel
Hobby or Pro.

For your scale, a practical stack is:

**Next.js + Vercel + Supabase (PostgreSQL + Auth + Storage) + a domain**

MathJax/KaTeX can be left out initially because equations and complex notation can be uploaded as images.

You can initially develop and test the entire system with very little or
no hosting cost. When you move it into official/institutional use,
revisit Vercel and Supabase plans, limits, and terms.

------------------------------------------------------------------------

## Suggested first milestone

Before building the complete platform, aim for this:

``` text
Student Login
      ↓
View Test
      ↓
Start Test
      ↓
50 MCQs + Timer
      ↓
Answer Questions
      ↓
Submit
      ↓
Automatic Evaluation
      ↓
View Score
```

Once this works reliably, add the admin panel, question importing,
auto-save, rankings, analytics, and other advanced features.
