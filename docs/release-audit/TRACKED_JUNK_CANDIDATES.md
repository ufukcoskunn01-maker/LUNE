# Tracked Junk Candidates

## likely should stay tracked
- `src/`, `public/`, `supabase/`, `tokens/`, `docs/`, `tests/`, `.github/`: core source, assets, database migrations, documentation, and CI config.
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `middleware.ts`, `tailwind.config.js`, `eslint.config.mjs`, `vercel.json`: required project configuration.
- `templates/A27-MonthlyHours-2026-02.xlsx`: appears to be a deliberate business template (not an ad-hoc export), but still worth periodic review.

## likely should be ignored
- `dev-server.log`: local runtime log file; machine/session specific.
- `out.xlsx`, `out2.xlsx`: ad-hoc export/report outputs at repo root; generated artifacts.
- `tmp/*` (6 tracked files): local temp/scratch outputs (`dev.stdout.log`, `dev.stderr.log`, references, and temporary spreadsheets).

## likely should be archived outside active repo
- `_zip_tmp/*` (98 tracked files): extracted website snapshot assets, minified bundles, media, and an input zip; high-noise/non-source payload.
- `_archive/*` (4 tracked files): legacy/backup app pages and old snapshots; useful for reference, but better in external archive branch/repo or release artifact storage.

## needs verification
- `postcss.config.js` and `postcss.config.mjs`: duplicate PostCSS configs at root; likely only one is active.
- `docs/release-audit/*`: current cleanup audit outputs are useful now, but some may become stale and should be pruned/archived after cleanup is complete.
- `next-env.d.ts`: currently untracked (not in this file by design), and Next.js templates commonly keep it tracked; decide and standardize.

## step 4 cleanup status (2026-03-03)
- Untracked from Git index (safe, non-destructive): `dev-server.log`, `out.xlsx`, `out2.xlsx`, `tmp/*`, `_zip_tmp/*`, `_archive/*`.
- Kept untouched for verification: `postcss.config.js`, `postcss.config.mjs`, `templates/`.
- Notes:
- Files removed with `git rm --cached` remain on local disk in this step.
- These paths are now excluded by `.gitignore`, reducing risk of accidental re-add.
