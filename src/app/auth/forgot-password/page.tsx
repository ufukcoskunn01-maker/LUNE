"use client";

import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const res = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (res.error) {
        setError(res.error.message);
        return;
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-10 text-zinc-100">
      <div className="w-full rounded-3xl border border-white/15 bg-black/45 p-7">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-zinc-400">Enter your email and we will send you a reset link.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3">
            <Mail className="h-4 w-4 text-zinc-500" />
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              required
            />
          </div>

          {error ? <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</div> : null}
          {sent ? <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Reset link sent. Check your email.</div> : null}

          <button
            type="submit"
            disabled={loading || !email}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium text-black disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send reset link
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-zinc-400">
          <Link href="/login" className="underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
