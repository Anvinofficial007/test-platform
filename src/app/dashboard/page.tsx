import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { formatInAppTz } from "@/lib/time";

function formatWindow(start: string, end: string) {
  return `${formatInAppTz(start, { dateStyle: "medium", timeStyle: "short" })} → ${formatInAppTz(end, { timeStyle: "short" })} IST`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role, name").eq("id", user.id).single();

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
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
              {profile?.name ? `Hello, ${profile.name.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              Weekly aptitude &amp; technical tests
            </p>
          </div>
          <div className="flex items-center gap-4 pt-1.5">
            {profile?.role === "admin" && (
              <Link href="/admin/tests" className="btn-text text-xs">
                Admin panel
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>

        <section className="mb-9">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-amber">Active now</span>
          </div>
          {active.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
              No test is live right now.
            </p>
          ) : (
            <div className="space-y-3">
              {active.map((t) => {
                const attempt = attemptByTest.get(t.id);
                const alreadySubmitted = attempt?.status === "submitted";
                return (
                  <div key={t.id} className="surface p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: "var(--ink)" }}>
                        {t.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {t.duration_minutes} min · {t.total_marks} marks · live until{" "}
                        {formatInAppTz(t.end_time, { timeStyle: "short" })} IST
                      </p>
                    </div>
                    {alreadySubmitted ? (
                      <Link href={`/result/${t.id}`} className="btn btn-secondary">
                        View result
                      </Link>
                    ) : (
                      <Link href={`/test/${t.id}`} className="btn btn-primary">
                        {attempt ? "Resume test" : "Start test"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-9">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-neutral">Upcoming</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
              Nothing scheduled yet.
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((t) => (
                <div key={t.id} className="surface p-4">
                  <p className="font-medium" style={{ color: "var(--ink)" }}>
                    {t.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                    {formatWindow(t.start_time, t.end_time)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-neutral">Previous results</span>
            </div>
            <div className="space-y-3">
              {past.map((t) => {
                const attempt = attemptByTest.get(t.id);
                return (
                  <div key={t.id} className="surface p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: "var(--ink)" }}>
                        {t.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {attempt?.status === "submitted"
                          ? `Score: ${attempt.score} / ${t.total_marks}`
                          : "Not attempted"}
                      </p>
                    </div>
                    {attempt?.status === "submitted" && (
                      <Link href={`/result/${t.id}`} className="btn btn-secondary">
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
