import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, NotAdminError } from "@/lib/supabase/adminGuard";
import { finalizeIfExpired } from "@/lib/scoring";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof NotAdminError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const { data: test } = await admin.from("tests").select("title, duration_minutes").eq("id", id).single();
  const { data: attemptsRaw } = await admin
    .from("attempts")
    .select("*")
    .eq("test_id", id)
    .order("score", { ascending: false, nullsFirst: false });

  const finalized = test
    ? await Promise.all((attemptsRaw ?? []).map((a) => finalizeIfExpired(admin, id, a, test.duration_minutes)))
    : attemptsRaw ?? [];

  const userIds = [...new Set(finalized.map((a) => a.user_id))];
  const { data: attemptUsers } = userIds.length
    ? await admin.from("users").select("id, name, register_number").in("id", userIds)
    : { data: [] };
  const userById = new Map((attemptUsers ?? []).map((u) => [u.id, u]));

  const header = ["Name", "Register Number", "Status", "Score", "Submitted At"];
  const rows = finalized
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
    .map((a) => {
      const u = userById.get(a.user_id);
      return [
        u?.name ?? "",
        u?.register_number ?? "",
        a.status,
        a.score !== null ? String(a.score) : "",
        a.submitted_at ?? "",
      ];
    });

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const filename = `${(test?.title ?? "results").replace(/[^a-z0-9]+/gi, "_")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
