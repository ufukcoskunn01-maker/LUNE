# Root Files Review

| Root item | Classification | Why |
|---|---|---|
| `.DS_Store` | ignore | OS metadata file (macOS); local junk. |
| `.env.example` | keep | Safe template for required environment variables. |
| `.env.local` | ignore | Local secrets/environment overrides. |
| `.env.local.swp` | ignore | Editor swap file. |
| `.git/` | keep | Repository metadata. |
| `.github/` | keep | CI/review automation and templates. |
| `.gitignore` | keep | Required ignore policy. |
| `.next/` | ignore | Next.js build output. |
| `_archive/` | archive | Legacy snapshots/backups; not active source. |
| `_zip_tmp/` | archive | Extracted/imported temporary payloads. |
| `components.json` | keep | UI/config metadata (likely shadcn). |
| `dev-server.log` | ignore | Local runtime log output. |
| `docs/` | keep | Project and operational documentation. |
| `eslint.config.mjs` | keep | Lint configuration. |
| `HOURLY_SYNC_SETUP.md` | keep | Operational setup document. |
| `middleware.ts` | keep | App runtime middleware source. |
| `next.config.ts` | keep | Next.js configuration. |
| `next-env.d.ts` | keep | Standard Next.js TypeScript environment file; now standardized and tracked. |
| `node_modules/` | ignore | Dependency install output. |
| `out.xlsx` | ignore | Local/generated export artifact in repo root. |
| `out2.xlsx` | ignore | Local/generated export artifact in repo root. |
| `package.json` | keep | Package manifest. |
| `package-lock.json` | keep | Deterministic dependency lockfile. |
| `postcss.config.js` | keep | Active PostCSS config resolved first by Next.js (`postcss.config.js` before `.mjs`) and includes `autoprefixer`. |
| `postcss.config.mjs` | archive | Redundant duplicate candidate; not selected when `.js` exists and currently differs from active config. Keep until cleanup commit confirms no workflow relies on it. |
| `public/` | keep | Runtime static assets. |
| `README.md` | keep | Primary project documentation. |
| `scripts/` | keep | Operational/import/maintenance scripts. |
| `src/` | keep | Application source code. |
| `supabase/` | keep | Database migrations and Supabase assets. |
| `tailwind.config.js` | keep | Styling framework config. |
| `templates/` | keep | Actively used by attendance export API as local fallback template source. |
| `tests/` | keep | Test suite. |
| `tmp/` | ignore | Local temp workspace and scratch artifacts. |
| `tokens/` | keep | Design/system tokens used by app. |
| `tsconfig.json` | keep | TypeScript configuration. |
| `tsconfig.tsbuildinfo` | ignore | Incremental TypeScript cache artifact. |
| `vercel.json` | keep | Deployment config for Vercel. |
