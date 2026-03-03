# Reference Check (Step 5)

Date: 2026-03-03

## Goal
Verify whether active source/config/build depends on cleanup targets:
- `_archive/`
- `_zip_tmp/`
- `tmp/`
- `out.xlsx`
- `out2.xlsx`
- `dev-server.log`

## Commands Run
```powershell
rg -n --hidden --glob '!node_modules/**' --glob '!.next/**' --glob '!.git/**' --glob '!docs/**' "_archive/|_zip_tmp/|tmp/|out\\.xlsx|out2\\.xlsx|dev-server\\.log" src scripts public supabase tests .gitignore eslint.config.mjs package.json next.config.ts tailwind.config.js
```

```powershell
rg -n "postcss\\.config(\\.js|\\.mjs)?|postcssrc|findConfig|loadPostCss" node_modules/next/dist/build -g "*.js"
Get-Content -Raw node_modules/next/dist/lib/find-config.js
```

```powershell
rg -n --hidden --glob '!node_modules/**' --glob '!.next/**' --glob '!.git/**' "templates/|A27-MonthlyHours-2026-02\\.xlsx|monthly-template-supabase\\.xlsx" .
Get-Content -Raw src/app/api/attendance/export-monthly-hours/route.ts
Get-ChildItem -Recurse templates | Select-Object FullName,Length,LastWriteTime
```

## Results
- No active runtime/source reference found to `_archive/`, `_zip_tmp/`, `tmp/`, `out.xlsx`, `out2.xlsx`, or `dev-server.log`.
- References found only in:
- `.gitignore`
- `eslint.config.mjs` ignore globs
- audit docs under `docs/release-audit/`
- `package-lock.json` URL text containing `tmp` package name

## PostCSS Resolution
- Next.js uses `findConfig(dir, 'postcss')`.
- Search order includes `postcss.config.js` before `postcss.config.mjs`.
- With both files present, `postcss.config.js` is the active config.

## Templates Classification
- `templates/A27-MonthlyHours-2026-02.xlsx` is actively used by `src/app/api/attendance/export-monthly-hours/route.ts` (`TEMPLATE_PATH`) as local fallback.
- Classification: **keep**.

## Risk Notes
- `_archive/*` contains old `.tsx` snapshots: untracking is likely safe, but keep local files and final-review before a destructive delete step.
- `postcss.config.mjs` appears redundant; remove only in a dedicated cleanup commit after explicit build verification.
