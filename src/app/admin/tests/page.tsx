import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatInAppTz } from "@/lib/time";

const statusStyles: Record<string, React.CSSProperties> = {
  draft: { background: "#ece8dd", color: "var(--ink-soft)" },
  published: { background: "var(--green-soft)", color: "var(--green)" },
  closed: { background: "#ddd7c8", color: "var(--ink-faint)" },
};

export default async function AdminTestsPage() {
  const admin = createAdminClient();
  const { data: tests } = await admin.from("tests").select("*").order("start_time", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
          Tests
        </h1>
        <Link href="/admin/tests/new" className="btn btn-primary">
          Create test
        </Link>
      </div>

      <div className="surface divider">
        {(tests ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--ink-faint)" }}>
            No tests yet — create your first one.
          </p>
        )}
        {(tests ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/admin/tests/${t.id}`}
            className="flex items-center justify-between px-4 py-3 transition-colors surface-hover"
          >
            <div>
              <p className="font-medium text-sm" style={{ color: "var(--ink)" }}>
                {t.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                {formatInAppTz(t.start_time, { dateStyle: "medium", timeStyle: "short" })} IST
                {" → "}
                {formatInAppTz(t.end_time, { timeStyle: "short" })} IST
                {" · "}
                {t.duration_minutes} min · {t.total_marks} marks
              </p>
            </div>
            <span className="badge" style={statusStyles[t.status]}>
              {t.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
