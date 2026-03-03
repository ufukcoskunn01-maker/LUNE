"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md px-6 py-14">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <div className="text-lg font-semibold">Set a new password</div>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          This is required on your first login.
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);

            if (p1.length < 10) return setErr("Password must be at least 10 characters.");
            if (p1 !== p2) return setErr("Passwords do not match.");

            setBusy(true);
            try {
              const r = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: p1 }),
              });
              const j = await r.json().catch(() => null);
              if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed");
              router.replace("/dashboard");
            } catch (e: unknown) {
              setErr(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">New password</label>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              type="password"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Confirm</label>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              type="password"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {err && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}

          <button
            disabled={busy}
            className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
