import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeAttempt } from "@/lib/scoring";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "No attempt found for this test" }, { status: 404 });
  }
  if (attempt.status === "submitted") {
    return NextResponse.json({ error: "This attempt was already submitted" }, { status: 403 });
  }

  const body = await req.json();
  const answers: Record<string, string | null> = body.answers ?? {};

  const admin = createAdminClient();
  const result = await finalizeAttempt(admin, id, attempt.id, answers);

  return NextResponse.json(result);
}
