import { createTest } from "@/app/admin/actions";
import { nowDatetimeLocalValue } from "@/lib/time";

export default function NewTestPage() {
  const defaultStart = nowDatetimeLocalValue();
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Create test</h1>

      <form action={createTest} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input
            name="title"
            required
            placeholder="Weekly Test #14 — Aptitude & Networks"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
            <input
              name="duration_minutes"
              type="number"
              min={1}
              required
              defaultValue={60}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-xs text-slate-400 mt-1">Time each student gets once they start.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default negative marking</label>
            <input
              name="negative_marks_default"
              type="number"
              step="0.25"
              min={0}
              defaultValue={0.25}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Live for</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                name="live_hours"
                type="number"
                min={0}
                required
                defaultValue={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-xs text-slate-400 mt-1">Hours</p>
            </div>
            <div>
              <input
                name="live_minutes"
                type="number"
                min={0}
                max={59}
                required
                defaultValue={0}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-xs text-slate-400 mt-1">Minutes</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            How long the test stays Active after the start time.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start time (IST)</label>
          <input
            name="start_time"
            type="datetime-local"
            required
            defaultValue={defaultStart}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <p className="text-xs text-slate-400 mt-1">
            Before this time a published test shows as Upcoming.
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2 hover:bg-slate-800"
        >
          Create test (as draft)
        </button>
      </form>
    </div>
  );
}
