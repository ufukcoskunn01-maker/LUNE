import Link from "next/link";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || "";

export default function RequestAccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-10 text-zinc-100">
      <div className="w-full rounded-3xl border border-white/15 bg-black/45 p-7">
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="mt-2 text-sm text-zinc-400">
          New accounts are provisioned by the project administrator to keep access controlled and auditable.
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
          {supportEmail ? (
            <>
              Request access by emailing{" "}
              <a href={`mailto:${supportEmail}`} className="underline underline-offset-2 hover:text-zinc-100">
                {supportEmail}
              </a>
              .
            </>
          ) : (
            <>Request access from your project administrator or IT support team.</>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-zinc-400">
          <Link href="/login" className="underline underline-offset-2 hover:text-zinc-100">
            Back to login
          </Link>
          <Link href="/auth/forgot-password" className="underline underline-offset-2 hover:text-zinc-100">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
