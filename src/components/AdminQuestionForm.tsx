"use client";

import { useState } from "react";
import { addQuestionWithUrls, requestSignedUploadUrl } from "@/app/admin/actions";

async function compressImage(file: File): Promise<File> {
  if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
    return file;
  }

  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxDimension = 1400;
  const { width, height } = imageBitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Could not compress image"));
      },
      "image/webp",
      0.8
    );
  });

  if (!blob) return file;
  const name = file.name.replace(/\.[^/.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}

async function uploadToSupabaseDirect(file: File, testId: string): Promise<string> {
  const { signedUrl, path, contentType } = await requestSignedUploadUrl(testId, file.name, file.type || undefined);
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed: ${response.statusText}`);
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question-images/${path}`;
  return publicUrl;
}

export default function AdminQuestionForm({ testId, defaultNegativeMarks }: { testId: string; defaultNegativeMarks: number }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setUploading(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      const uploadFields = [
        ["question_image", "question_image_url"],
        ["option_a_image", "option_a_image_url"],
        ["option_b_image", "option_b_image_url"],
        ["option_c_image", "option_c_image_url"],
        ["option_d_image", "option_d_image_url"],
      ] as const;

      const uploaded: Record<string, string | null> = {};

      for (const [inputName, outputName] of uploadFields) {
        const original = formData.get(inputName);
        if (!(original instanceof File) || original.size === 0) {
          uploaded[outputName] = null;
          continue;
        }

        const compressed = await compressImage(original);
        uploaded[outputName] = await uploadToSupabaseDirect(compressed, testId);
      }

      const payload = {
        question_text: String(formData.get("question_text") ?? ""),
        question_image_url: uploaded.question_image_url ?? null,
        option_a_text: String(formData.get("option_a_text") ?? ""),
        option_a_image_url: uploaded.option_a_image_url ?? null,
        option_b_text: String(formData.get("option_b_text") ?? ""),
        option_b_image_url: uploaded.option_b_image_url ?? null,
        option_c_text: String(formData.get("option_c_text") ?? ""),
        option_c_image_url: uploaded.option_c_image_url ?? null,
        option_d_text: String(formData.get("option_d_text") ?? ""),
        option_d_image_url: uploaded.option_d_image_url ?? null,
        correct_answer: String(formData.get("correct_answer") ?? "") as "A" | "B" | "C" | "D",
        marks: Number(formData.get("marks") ?? 1),
        negative_marks: Number(formData.get("negative_marks") ?? defaultNegativeMarks),
      };

      await addQuestionWithUrls(testId, payload);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsSubmitting(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        name="question_text"
        placeholder="Question text (optional if using an image)"
        className="field-input"
      />
      <div>
        <label className="field-label">Question image (optional)</label>
        <input name="question_image" type="file" accept="image/*" className="field-file" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Option A</label>
          <input name="option_a_text" placeholder="Text" required className="field-input mb-1.5" />
          <input name="option_a_image" type="file" accept="image/*" className="field-file" />
        </div>
        <div>
          <label className="field-label">Option B</label>
          <input name="option_b_text" placeholder="Text" required className="field-input mb-1.5" />
          <input name="option_b_image" type="file" accept="image/*" className="field-file" />
        </div>
        <div>
          <label className="field-label">Option C</label>
          <input name="option_c_text" placeholder="Text" required className="field-input mb-1.5" />
          <input name="option_c_image" type="file" accept="image/*" className="field-file" />
        </div>
        <div>
          <label className="field-label">Option D</label>
          <input name="option_d_text" placeholder="Text" required className="field-input mb-1.5" />
          <input name="option_d_image" type="file" accept="image/*" className="field-file" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="field-label">Correct</label>
          <select name="correct_answer" required className="field-input">
            <option value="">—</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
        <div>
          <label className="field-label">Marks</label>
          <input name="marks" type="number" step="0.25" defaultValue={1} className="field-input" />
        </div>
        <div>
          <label className="field-label">Negative</label>
          <input name="negative_marks" type="number" step="0.25" defaultValue={defaultNegativeMarks} className="field-input" />
        </div>
      </div>

      {uploading && (
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          Uploading images and saving question…
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      <button className="btn btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Add question"}
      </button>
    </form>
  );
}
