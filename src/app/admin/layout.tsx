import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role, name").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/tests" className="font-semibold text-slate-900 text-sm">
              Admin panel
            </Link>
            <Link href="/admin/tests" className="text-sm text-slate-500 hover:text-slate-900">
              Tests
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-slate-400 hover:text-slate-700">
              Student view
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
