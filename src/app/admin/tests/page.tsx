import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatInAppTz } from "@/lib/time";

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-500",
};

export default async function AdminTestsPage() {
  const admin = createAdminClient();
  const { data: tests } = await admin.from("tests").select("*").order("start_time", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Tests</h1>
        <Link
          href="/admin/tests/new"
          className="rounded-md bg-slate-900 text-white text-sm px-4 py-2 hover:bg-slate-800"
        >
          Create test
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {(tests ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400">No tests yet — create your first one.</p>
        )}
        {(tests ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/admin/tests/${t.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900 text-sm">{t.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatInAppTz(t.start_time, { dateStyle: "medium", timeStyle: "short" })} IST
                {" → "}
                {formatInAppTz(t.end_time, { timeStyle: "short" })} IST
                {" · "}
                {t.duration_minutes} min · {t.total_marks} marks
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded ${statusStyles[t.status]}`}>
              {t.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
