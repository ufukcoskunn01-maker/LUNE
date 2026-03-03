"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type MePayload = {
  ok?: boolean;
  user?: { id: string; email?: string | null } | null;
  profile?: { must_change_password?: boolean | null } | null;
  data?: {
    user?: { id: string; email?: string | null } | null;
    profile?: { must_change_password?: boolean | null } | null;
  };
};

function passwordChecks(password: string) {
  return {
    minLength: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export default function ForcePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const checks = passwordChecks(newPassword);
  const strongEnough = checks.minLength && checks.uppercase && checks.lowercase && checks.number && checks.symbol;

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await res.json().catch(() => null)) as MePayload | null;
        const user = payload?.data?.user || payload?.user || null;
        const profile = payload?.data?.profile || payload?.profile || null;
        const mustChange = Boolean(profile?.must_change_password);

        if (!cancelled) {
          if (!user) {
            router.replace("/login");
            return;
          }
          if (!mustChange) {
            router.replace("/");
            return;
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!strongEnough) return setError("Password does not meet complexity requirements.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");

    setSaving(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) return setError(userError?.message || "No authenticated session.");

      const updated = await supabase.auth.updateUser({ password: newPassword });
      if (updated.error) return setError(updated.error.message);

      const profileUpdate = await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
      if (profileUpdate.error) return setError(profileUpdate.error.message);

      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-10 text-zinc-100">
      <div className="w-full rounded-3xl border border-white/15 bg-black/45 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl border border-white/20 bg-white/5 p-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Set new password</h1>
            <p className="mt-1 text-sm text-zinc-400">Your temporary password must be changed before using LUNE.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center text-sm text-zinc-300">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking session...
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">New password</span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 focus-within:ring-2 focus-within:ring-cyan-300/40">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  autoComplete="new-password"
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
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">Confirm password</span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 focus-within:ring-2 focus-within:ring-cyan-300/40">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            <div className="rounded-xl border border-white/10 bg-black/35 p-3 text-xs text-zinc-300">
              <div className={checks.minLength ? "text-emerald-300" : "text-zinc-400"}>• At least 10 characters</div>
              <div className={checks.uppercase ? "text-emerald-300" : "text-zinc-400"}>• One uppercase letter</div>
              <div className={checks.lowercase ? "text-emerald-300" : "text-zinc-400"}>• One lowercase letter</div>
              <div className={checks.number ? "text-emerald-300" : "text-zinc-400"}>• One number</div>
              <div className={checks.symbol ? "text-emerald-300" : "text-zinc-400"}>• One special character</div>
            </div>

            {error ? <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</div> : null}

            <button
              type="submit"
              disabled={saving || !newPassword || !confirmPassword}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/20 text-sm font-medium text-cyan-50 hover:bg-cyan-500/30 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center text-xs text-zinc-400">
          Need help? <Link href="/auth/forgot-password" className="underline">Reset by email</Link>
        </div>
      </div>
    </div>
  );
}
