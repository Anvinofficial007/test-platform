import { createTest } from "@/app/admin/actions";
import { nowDatetimeLocalValue } from "@/lib/time";

export default function NewTestPage() {
  const defaultStart = nowDatetimeLocalValue();
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6" style={{ color: "var(--ink)" }}>Create test</h1>

      <form action={createTest} className="surface p-6 space-y-4">
        <div>
          <label className="field-label">Title</label>
          <input
            name="title"
            required
            placeholder="Weekly Test #14 — Aptitude & Networks"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea
            name="description"
            rows={2}
            className="field-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Duration (minutes)</label>
            <input
              name="duration_minutes"
              type="number"
              min={1}
              required
              defaultValue={60}
              className="field-input"
            />
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Time each student gets once they start.</p>
          </div>
          <div>
            <label className="field-label">Default negative marking</label>
            <input
              name="negative_marks_default"
              type="number"
              step="0.25"
              min={0}
              defaultValue={0.25}
              className="field-input"
            />
          </div>
        </div>

        <div>
          <label className="field-label">Live for</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                name="live_hours"
                type="number"
                min={0}
                required
                defaultValue={3}
                className="field-input"
              />
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Hours</p>
            </div>
            <div>
              <input
                name="live_minutes"
                type="number"
                min={0}
                max={59}
                required
                defaultValue={0}
                className="field-input"
              />
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Minutes</p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
            How long the test stays Active after the start time.
          </p>
        </div>

        <div>
          <label className="field-label">Start time (IST)</label>
          <input
            name="start_time"
            type="datetime-local"
            required
            defaultValue={defaultStart}
            className="field-input"
          />
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Before this time a published test shows as Upcoming.
          </p>
        </div>

        <button type="submit" className="btn btn-primary w-full">
          Create test (as draft)
        </button>
      </form>
    </div>
  );
}
