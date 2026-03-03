import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function supabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, service, { auth: { persistSession: false } });
}

const LoginBodySchema = z.object({
  identifier: z.string().trim().min(1, "Username/email is required.").max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(256),
  next: z.string().optional(),
  captchaToken: z.string().optional(),
});

type LoginRateLimitState = {
  count: number;
  windowStartedAt: number;
  lockedUntil: number;
};

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 7;
const RATE_LOCK_MS = 10 * 60 * 1000;
const RATE_PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

function getRateStore(): Map<string, LoginRateLimitState> {
  const globalStore = globalThis as typeof globalThis & {
    __loginRateStore?: Map<string, LoginRateLimitState>;
  };
  if (!globalStore.__loginRateStore) {
    globalStore.__loginRateStore = new Map<string, LoginRateLimitState>();
  }
  return globalStore.__loginRateStore;
}

function getClientIp(request: NextRequest): string {
  const ipHeader =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for") ||
    "";

  const firstIp = ipHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)[0];

  return firstIp || "unknown";
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function safeNextPath(rawNext: string | undefined): string {
  const fallback = "/dashboard";
  if (!rawNext) return fallback;
  const candidate = rawNext.trim();
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  return candidate;
}

function pruneRateStore(store: Map<string, LoginRateLimitState>, now: number) {
  for (const [key, value] of store.entries()) {
    const recentActivity = Math.max(value.windowStartedAt, value.lockedUntil);
    if (now - recentActivity > RATE_PRUNE_AGE_MS) {
      store.delete(key);
    }
  }
}

function loginRateKey(request: NextRequest, identifier: string): string {
  return `${getClientIp(request)}:${normalizeIdentifier(identifier)}`;
}

function getRateLimitStatus(store: Map<string, LoginRateLimitState>, key: string, now: number) {
  const state = store.get(key);
  if (!state) return { allowed: true as const, retryAfterSeconds: 0 };

  if (state.lockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
    return { allowed: false as const, retryAfterSeconds };
  }

  if (now - state.windowStartedAt > RATE_WINDOW_MS) {
    store.set(key, { count: 0, windowStartedAt: now, lockedUntil: 0 });
  }

  return { allowed: true as const, retryAfterSeconds: 0 };
}

function registerFailedLogin(store: Map<string, LoginRateLimitState>, key: string, now: number) {
  const current = store.get(key);
  if (!current || now - current.windowStartedAt > RATE_WINDOW_MS) {
    store.set(key, { count: 1, windowStartedAt: now, lockedUntil: 0 });
    return;
  }

  const nextCount = current.count + 1;
  if (nextCount >= RATE_MAX_ATTEMPTS) {
    store.set(key, { count: nextCount, windowStartedAt: current.windowStartedAt, lockedUntil: now + RATE_LOCK_MS });
    return;
  }

  store.set(key, { count: nextCount, windowStartedAt: current.windowStartedAt, lockedUntil: 0 });
}

function clearLoginFailures(store: Map<string, LoginRateLimitState>, key: string) {
  store.delete(key);
}

async function verifyRecaptchaToken(token: string, remoteIp: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) return true;

  if (!token.trim()) return false;

  const payload = new URLSearchParams();
  payload.set("secret", secret);
  payload.set("response", token.trim());
  if (remoteIp && remoteIp !== "unknown") payload.set("remoteip", remoteIp);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
    cache: "no-store",
  });

  if (!response.ok) return false;

  const result = (await response.json()) as {
    success?: boolean;
    score?: number;
    action?: string;
  };

  if (!result.success) return false;
  if (typeof result.score === "number" && result.score < 0.4) return false;
  if (result.action && result.action !== "login") return false;

  return true;
}

export async function POST(req: NextRequest) {
  const rateStore = getRateStore();
  const now = Date.now();
  pruneRateStore(rateStore, now);

  try {
    const rawBody = (await req.json().catch(() => null)) as unknown;
    const parsed = LoginBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid login payload." }, { status: 400 });
    }

    const identifier = parsed.data.identifier.trim();
    const password = parsed.data.password;
    const next = safeNextPath(parsed.data.next);
    const captchaToken = parsed.data.captchaToken || "";

    const rateKey = loginRateKey(req, identifier);
    const rateStatus = getRateLimitStatus(rateStore, rateKey, now);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many login attempts. Please try again later.",
          retryAfterSeconds: rateStatus.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const clientIp = getClientIp(req);
    const captchaOk = await verifyRecaptchaToken(captchaToken, clientIp);
    if (!captchaOk) {
      registerFailedLogin(rateStore, rateKey, now);
      return NextResponse.json({ ok: false, error: "Security verification failed. Please try again." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = supabaseKey();
    if (!url || !key) {
      return NextResponse.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true }, { status: 200 });
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    let email = identifier;
    if (!identifier.includes("@")) {
      const admin = adminClient();
      const { data, error } = await admin.from("profiles").select("email").eq("username", identifier).maybeSingle();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      if (!data?.email) {
        registerFailedLogin(rateStore, rateKey, now);
        return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
      }

      email = data.email;
    }

    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn.user) {
      registerFailedLogin(rateStore, rateKey, now);
      return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }

    clearLoginFailures(rateStore, rateKey);

    const admin = adminClient();
    const { data: prof } = await admin.from("profiles").select("must_change_password").eq("user_id", signIn.user.id).maybeSingle();

    const redirectTo = prof?.must_change_password ? "/auth/change-password" : next;

    return NextResponse.json({ ok: true, next: redirectTo }, { status: 200, headers: response.headers });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
