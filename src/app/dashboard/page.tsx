import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

function formatWindow(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} → ${e.toLocaleString(
    undefined,
    { timeStyle: "short" }
  )}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();

  const { data: tests } = await supabase
    .from("tests")
    .select("*")
    .eq("status", "published")
    .order("start_time", { ascending: true });

  const { data: myAttempts } = await supabase
    .from("attempts")
    .select("test_id, status, score")
    .eq("user_id", user.id);

  const attemptByTest = new Map((myAttempts ?? []).map((a) => [a.test_id, a]));

  const now = Date.now();
  const all = tests ?? [];
  const active = all.filter(
    (t) => new Date(t.start_time).getTime() <= now && new Date(t.end_time).getTime() >= now
  );
  const upcoming = all.filter((t) => new Date(t.start_time).getTime() > now);
  const past = all.filter((t) => new Date(t.end_time).getTime() < now);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            {profile?.role === "admin" && (
              <Link href="/admin/tests" className="text-xs text-slate-500 hover:text-slate-900">
                Admin panel
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-8">Weekly aptitude & technical tests</p>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-700 mb-3">Active now</h2>
          {active.length === 0 ? (
            <p className="text-sm text-slate-400">No test is live right now.</p>
          ) : (
            <div className="space-y-3">
              {active.map((t) => {
                const attempt = attemptByTest.get(t.id);
                const alreadySubmitted = attempt?.status === "submitted";
                return (
                  <div
                    key={t.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{t.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t.duration_minutes} min · {t.total_marks} marks
                      </p>
                    </div>
                    {alreadySubmitted ? (
                      <Link
                        href={`/result/${t.id}`}
                        className="rounded-md border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50"
                      >
                        View result
                      </Link>
                    ) : (
                      <Link
                        href={`/test/${t.id}`}
                        className="rounded-md bg-slate-900 text-white text-sm px-4 py-2 hover:bg-slate-800 transition-colors"
                      >
                        {attempt ? "Resume test" : "Start test"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-700 mb-3">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing scheduled yet.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((t) => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatWindow(t.start_time, t.end_time)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-700 mb-3">Previous results</h2>
            <div className="space-y-3">
              {past.map((t) => {
                const attempt = attemptByTest.get(t.id);
                return (
                  <div
                    key={t.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{t.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {attempt?.status === "submitted"
                          ? `Score: ${attempt.score} / ${t.total_marks}`
                          : "Not attempted"}
                      </p>
                    </div>
                    {attempt?.status === "submitted" && (
                      <Link
                        href={`/result/${t.id}`}
                        className="rounded-md border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
