"use client";

import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function passwordChecks(password: string) {
  return {
    minLength: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const checks = passwordChecks(newPassword);
  const strongEnough = checks.minLength && checks.uppercase && checks.lowercase && checks.number && checks.symbol;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!strongEnough) return setError("Password does not meet complexity requirements.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");

    setSaving(true);
    try {
      const update = await supabase.auth.updateUser({ password: newPassword });
      if (update.error) return setError(update.error.message);

      const user = update.data.user;
      if (user?.id) {
        await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
      }

      setDone(true);
      setTimeout(() => {
        router.replace("/login");
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password reset failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-10 text-zinc-100">
      <div className="w-full rounded-3xl border border-white/15 bg-black/45 p-7">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="mt-1 text-sm text-zinc-400">Set a new password for your account.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="New password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex h-11 items-center rounded-xl border border-white/15 bg-black/40 px-3">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Confirm password"
              required
            />
          </div>

          {error ? <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</div> : null}
          {done ? <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Password updated. Redirecting to login...</div> : null}

          <button
            type="submit"
            disabled={saving || !newPassword || !confirmPassword}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium text-black disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Update password
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
