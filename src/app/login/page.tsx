"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      if (!name.trim() || !registerNumber.trim()) {
        setError("Name and register number are required.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (data.user) {
        // Create the matching row in public.users (RLS lets a user insert their own row
        // once we add that policy — for now this runs via the authenticated session).
        const { error: profileError } = await supabase.from("users").insert({
          id: data.user.id,
          name: name.trim(),
          register_number: registerNumber.trim(),
          email,
          role: "student",
        });
        if (profileError) {
          setError(`Signed up, but couldn't save your profile: ${profileError.message}`);
          setLoading(false);
          return;
        }
      }
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
            Weekly Test Portal
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            {mode === "signin" ? "Sign in to continue" : "Create your student account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface p-6 space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label className="field-label">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Register number</label>
                <input
                  type="text"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  placeholder="e.g. TKM21EC045"
                  className="field-input"
                />
              </div>
            </>
          )}

          <div>
            <label className="field-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="btn-text mt-4 w-full text-center text-xs"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
