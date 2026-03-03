"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,64}$/;

function validateIdentifier(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your username or email.";
  if (trimmed.includes("@")) {
    if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address.";
    return null;
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return "Username must be 3-64 characters and use letters, numbers, ., _ or -.";
  }
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Enter your password.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  return null;
}

function fieldClass(hasError: boolean, hasValue: boolean): string {
  if (hasError) return "border-red-300/60 bg-red-500/5";
  if (hasValue) return "border-emerald-300/40 bg-emerald-500/5";
  return "border-white/15 bg-black/25";
}

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/dashboard");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const nextParam = new URLSearchParams(window.location.search).get("next");
    if (nextParam && nextParam.startsWith("/")) setNext(nextParam);
  }, []);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    if (document.querySelector('script[data-recaptcha="login"]')) return;

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptcha = "login";
    document.head.appendChild(script);
  }, []);

  const identifierError = useMemo(() => validateIdentifier(identifier), [identifier]);
  const passwordError = useMemo(() => validatePassword(password), [password]);

  const showIdentifierError = (submitAttempted || identifierTouched) && Boolean(identifierError);
  const showPasswordError = (submitAttempted || passwordTouched) && Boolean(passwordError);
  const canSubmit = !identifierError && !passwordError && !busy;

  async function getCaptchaToken(): Promise<string | undefined> {
    if (!RECAPTCHA_SITE_KEY) return undefined;
    if (!window.grecaptcha) throw new Error("Security check is still loading. Please try again.");

    await new Promise<void>((resolve) => window.grecaptcha!.ready(resolve));
    return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "login" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setErr(null);

    if (!canSubmit) {
      setIdentifierTouched(true);
      setPasswordTouched(true);
      setErr("Please fix highlighted fields and try again.");
      return;
    }

    setBusy(true);
    try {
      const captchaToken = await getCaptchaToken();

      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          next,
          captchaToken,
        }),
      });
      const j = (await r.json().catch(() => null)) as
        | { ok?: boolean; error?: string; next?: string; retryAfterSeconds?: number }
        | null;

      if (!r.ok || !j?.ok) {
        if (r.status === 429 && typeof j?.retryAfterSeconds === "number") {
          throw new Error(`Too many login attempts. Try again in ${j.retryAfterSeconds}s.`);
        }
        throw new Error(j?.error || "Login failed");
      }

      router.replace(j.next || next);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1240px] items-center px-4 py-8 md:px-8">
        <div className="grid w-full gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[28px] border border-white/10 bg-[#111111] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.45)] md:p-8">
            <div className="mx-auto w-full max-w-[420px]">
              <div className="mb-6 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/5">
                  <Image src="/brand/lune-logo-mark-white.svg" alt="LUNE logo" width={26} height={16} className="h-auto w-7" priority />
                </div>
              </div>

              <h1 className="text-center text-[44px] font-semibold leading-[1.1] tracking-tight text-white md:text-[52px]">Welcome back</h1>
              <p className="mt-2 text-center text-sm text-zinc-400">LUNE A27 Project Controls Platform</p>

              <button
                type="button"
                onClick={() => setErr("Use username/email sign-in. SSO will be enabled by administrator.")}
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/30 text-sm text-zinc-200 transition hover:bg-black/45"
              >
                <Image
                  src="/login-assets/icon-right.svg"
                  alt="Apple logo"
                  width={14}
                  height={16}
                  className="h-4 w-auto brightness-0 invert"
                />
                SSO through employer
              </button>

              <div className="relative mt-6">
                <div className="h-px w-full bg-white/10" />
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[#111111] px-3 text-xs text-zinc-400">
                  Or sign in with email
                </span>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <label htmlFor="identifier" className="mb-1.5 block text-sm text-zinc-300">
                    E-mail / Username
                  </label>
                  <div
                    className={`flex h-12 items-center gap-2 rounded-xl border px-3 transition-colors ${fieldClass(
                      showIdentifierError,
                      !identifierError && identifier.trim().length > 0
                    )}`}
                  >
                    <User className="h-4 w-4 text-zinc-500" />
                    <input
                      id="identifier"
                      className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                      placeholder="Enter your email"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      onBlur={() => setIdentifierTouched(true)}
                      autoComplete="username"
                      aria-invalid={showIdentifierError}
                      required
                    />
                  </div>
                  {showIdentifierError ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-red-300">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {identifierError}
                    </div>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm text-zinc-300">
                    Password
                  </label>
                  <div
                    className={`flex h-12 items-center gap-2 rounded-xl border px-3 transition-colors ${fieldClass(
                      showPasswordError,
                      !passwordError && password.length > 0
                    )}`}
                  >
                    <Lock className="h-4 w-4 text-zinc-500" />
                    <input
                      id="password"
                      className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onBlur={() => setPasswordTouched(true)}
                      autoComplete="current-password"
                      aria-invalid={showPasswordError}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {showPasswordError ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-red-300">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {passwordError}
                    </div>
                  ) : null}
                </div>

                <div className="text-center text-sm">
                  <Link href="/auth/forgot-password" className="text-zinc-300 underline underline-offset-2 hover:text-white">
                    Forgot your password?
                  </Link>
                </div>

                {err ? (
                  <div className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">{err}</div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[22px] font-medium text-[#0b0b10] transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {busy ? "Signing in..." : "Sign in"}
                  {!busy ? <ArrowRight className="h-4 w-4" /> : null}
                </button>

                <div className="text-center text-sm text-zinc-400">
                  Don&apos;t have an account yet?{" "}
                  <Link href="/auth/request-access" className="underline underline-offset-2 hover:text-white">
                    Sign up
                  </Link>
                </div>

                {RECAPTCHA_SITE_KEY ? (
                  <p className="text-center text-[11px] text-zinc-500">
                    Protected by reCAPTCHA. Google Privacy Policy and Terms of Service apply.
                  </p>
                ) : null}
              </form>
            </div>
          </section>

          <aside className="relative hidden overflow-hidden rounded-[28px] border border-white/10 bg-[#0a111b] p-8 shadow-[0_28px_70px_rgba(0,0,0,0.45)] lg:flex lg:flex-col lg:justify-between">
            <Image src="/login-assets/hero-bg.jpeg" alt="Night sky" fill className="object-cover" priority />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.3)_0%,rgba(7,11,19,0.48)_100%)]" />

            <div className="relative z-10 pt-8 text-center">
              <h2 className="mx-auto max-w-[460px] text-[38px] font-semibold leading-[1.08] tracking-tight text-white md:text-[44px]">
                Track progress, ask anything. Own your project truth.
              </h2>

              <div className="mt-7 inline-flex flex-col items-center rounded-full bg-black/20 px-5 py-2">
                <div className="inline-flex items-center gap-2">
                  <Image
                    src="/login-assets/bg.svg"
                    alt="Decorative left wing"
                    width={18}
                    height={49}
                    className="h-4 w-auto brightness-0 invert opacity-90"
                  />
                  <div className="inline-flex items-center gap-1 text-[11px] leading-none text-amber-300">
                    <span>★</span>
                    <span>★</span>
                    <span>★</span>
                    <span>★</span>
                    <span>★</span>
                  </div>
                  <Image
                    src="/login-assets/icon-left.svg"
                    alt="Decorative right wing"
                    width={18}
                    height={49}
                    className="h-4 w-auto brightness-0 invert opacity-90"
                  />
                </div>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-100">MANAGE PROJECT</span>
              </div>
            </div>

            <div className="relative z-10 mx-auto w-full max-w-[430px] rounded-[22px] border border-white/30 bg-[linear-gradient(180deg,rgba(194,211,230,0.14)_0%,rgba(95,122,149,0.15)_100%)] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                <span>Project status this month</span>
                <span className="rounded-full border border-white/30 px-2 py-0.5 text-[9px]">A27</span>
              </div>
              <div className="mt-4 text-[36px] font-semibold leading-none text-white">84%</div>
              <div className="mt-1 text-xs text-zinc-300">On-track activities this month</div>

              <div className="mt-5 h-[72px] overflow-hidden rounded-xl border border-white/20 bg-black/20 px-2 pt-2">
                <svg viewBox="0 0 360 68" className="h-full w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="chartLine" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#d9ecff" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>
                  <path d="M0 54 C40 54, 68 49, 104 41 C141 32, 166 16, 207 13 C248 11, 281 16, 320 24 C338 28, 349 30, 360 31" fill="none" stroke="url(#chartLine)" strokeWidth="2.8" />
                </svg>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-300">
                <span>Week 01</span>
                <span>Week 02</span>
                <span>Week 03</span>
                <span>Week 04</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
