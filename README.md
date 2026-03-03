This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Auth Setup (Supabase SSR)

1. Run migration:
   - `supabase/migrations/202602251730_profiles_auth.sql`
2. Ensure env vars are present:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key fallback)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. Create users in Supabase Auth with temporary passwords.
4. Create matching rows in `public.profiles` with:
   - `role`, `profession`, `must_change_password=true`
5. Login flow:
   - `/login` -> sign in
   - if `must_change_password=true` -> redirected to `/auth/change-password`
   - after update -> redirected to `/`

## Design Tokens Sync (Tokens Studio -> Repo -> CSS)

Figma Tokens Studio is the source of truth for design tokens.

1. Update tokens in Figma (Tokens Studio).
2. Sync/push token JSON to this repo at `tokens/tokens.json`.
3. Run `npm run tokens:build` (also runs automatically on `npm run build` via `prebuild`).
4. Deploy. Generated variables are written to `src/app/tokens.generated.css` and imported by `src/app/globals.css`.

Validation:

```bash
npm run tokens:build
npm run dev
npm run build
```

## AI Assistant Smoke Test

1. Run Supabase migrations in SQL editor:
   - `supabase/migrations/20260224_ai_assistant.sql`
   - `supabase/migrations/20260224_ai_threads_messages_base.sql`
2. Open `/login` and sign in with your Supabase Auth account.
3. Open `/ai`, start a new thread, send a message, and verify responses.
4. Verify thread IDs are UUIDs and no `dev-thread-*` IDs are used.
5. Confirm no `OPENAI_API_KEY` usage exists in client-side files.

## Transportation Setup Checklist

1. Run migration:
   - `supabase/migrations/20260225_transportation.sql`
2. Ensure bucket exists and is private:
   - `transport-approvals`
3. Add at least one reporter:
   - Insert user id into `public.transport_reporters` (for example via SQL editor).
4. Open `/daily-personal-reports` (or `/personal`), switch to **Transportation** tab.
5. Verify:
   - Daily board loads for selected date.
   - Reporter can submit photo report (morning/evening, trips, plate).
   - Monthly analytics loads.
   - Monthly export works (`xlsx` / `csv`).

## Installation Module Setup Checklist

1. Run migration:
   - `supabase/migrations/202602251300_installations.sql`
2. Ensure env vars are set:
   - `SUPABASE_STORAGE_BUCKET` (defaults to `project-files`)
   - `INSTALLATIONS_ROOT_PREFIX` (optional; defaults to `${projectCode}/2-Daily Field Reports`)
3. For write operations (`/api/installations/sync`), grant role:
   - Insert users into `public.user_roles` with `role in ('admin','planner')`
4. Open `/installations` and click **Sync from Storage**.
5. Verify:
   - Calendar month shows highlighted days with reports.
   - Selecting a day loads rows/totals/pivots and crew.
   - Month export downloads CSV/XLSX matrix.

## Daily Installation Reports Setup (Single DB-First Pipeline)

1. Run migration:
   - `supabase/migrations/202603031000_daily_installation_reports_pipeline.sql`
2. Ensure env vars are set:
   - `SUPABASE_STORAGE_BUCKET` (defaults to `project-files`)
3. Open `/daily-installation-reports`.
4. Upload a `.xlsx` / `.xlsm` report from the page.
5. Verify:
   - A file row is inserted into `daily_installation_report_files` with status lifecycle:
     `uploaded -> processing -> ready` (or `failed`).
   - Parsed summary is persisted in `daily_installation_reports`.
   - Parsed line items are persisted in `daily_installation_report_items`.
   - UI updates live from database realtime events without storage listing.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
