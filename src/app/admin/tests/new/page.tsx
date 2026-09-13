import { createTest } from "@/app/admin/actions";

export default function NewTestPage() {
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
          <input
            name="start_time"
            type="datetime-local"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <p className="text-xs text-slate-400 mt-1">
            End time is calculated automatically from start time + duration.
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
