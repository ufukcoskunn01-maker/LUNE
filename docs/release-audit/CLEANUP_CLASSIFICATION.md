# Repository Cleanup Classification

**Date**: 2026-03-03  
**Branch**: chore/overnight-files-sync  
**Tracked Files**: 461  
**Status**: Ready for audit and cleanup

---

## Classification Matrix

### ✅ KEEP IN ACTIVE REPO (Core Project Files)

#### Configuration & Build
- `package.json` — npm dependencies and scripts (REQUIRED)
- `package-lock.json` — npm lock file (REQUIRED)
- `tsconfig.json` — TypeScript configuration (REQUIRED)
- `next.config.ts` — Next.js configuration (REQUIRED)
- `postcss.config.js` / `postcss.config.mjs` — PostCSS for Tailwind (REQUIRED)
- `tailwind.config.js` — Tailwind CSS configuration (REQUIRED)
- `eslint.config.mjs` — ESLint linting rules (REQUIRED)
- `components.json` — shadcn/ui components config (REQUIRED)
- `.env.example` — environment template for docs (REQUIRED)
- `vercel.json` — Vercel deployment config (REQUIRED)
- `middleware.ts` — Next.js middleware (REQUIRED)
- `.github/workflows/ci.yml` — CI/CD pipeline (REQUIRED)
- `.github/CODEOWNERS` — code ownership rules (REQUIRED)
- `.github/pull_request_template.md` — PR template (REQUIRED)

#### Core Application
- `src/app/` — Next.js App Router pages and layouts (REQUIRED)
- `src/components/` — React components and UI (REQUIRED)
- `src/lib/` — Utility functions, API clients, business logic (REQUIRED)
- `src/types/` — TypeScript type definitions (REQUIRED)
- `src/features/` — Feature modules (REQUIRED)
- `public/brand/` — Brand assets and logos (REQUIRED)
- `public/login-assets/` — Login page assets (REQUIRED)
- `public/origin/` — Origin reference assets (REQUIRED)

#### Database & Infrastructure
- `supabase/migrations/` — Database migration files (REQUIRED)
- `docs/` — Project documentation (REQUIRED but needs improvement)

#### Scripts & Testing
- `scripts/` — Utility and maintenance scripts (REQUIRED)
- `tests/` — Test files (REQUIRED)

#### Git & Documentation
- `.gitignore` — git ignore rules (REQUIRED)
- `README.md` — project readme (EXISTS but generic, needs improvement)
- `next-env.d.ts` — Next.js auto-generated types (REQUIRED, auto-generated)

---

### 🗑️ IGNORE FROM SOURCE CONTROL (Already in .gitignore, verified)

**Build & Runtime Artifacts:**
- `node_modules/` — npm dependencies directory
- `.next/` — Next.js build output
- `/out/` — Static export output
- `/build/` — Build directory
- `/dist/` — Distribution directory
- `/coverage/` — Test coverage reports

**Environment Secrets:**
- `.env` — local environment secrets
- `.env.local` — environment overrides
- `.env.*.local` — environment stage overrides
- `.pem` files — private key files

**Temporary & Cache:**
- `npm-debug.log*` — npm logs
- `yarn-debug.log*` — yarn logs
- `yarn-error.log*` — yarn errors
- `.pnpm-debug.log*` — pnpm logs
- `*.tsbuildinfo` — TypeScript build info
- `.DS_Store` — macOS system file
- `.vercel/` — Vercel cache

**Editor & IDE:**
- `.idea/` — IntelliJ IDE config
- `.vscode/` — VS Code workspace config (acceptable, but user-specific)

---

### ⚠️ ARCHIVE OUTSIDE ACTIVE REPO (Remove from Git)

**Status:** These directories are currently tracked in Git but should NOT be.

#### `_archive/` Directory
**Contents:**
- `dashboard.old.tsx` — old dashboard component
- `dashboard_root/page.tsx` — old root page
- `attendance_root/page.tsx` — old attendance root
- `attendance_group/page.tsx` — old attendance group
- `pages_old/` — old pages directory
- `app_root_empty_backup/` — backup of app root

**Reasoning:**
- Legacy/deprecated code not in active use
- Clutters repository with dead code
- Should be preserved in git history but removed from active code
- Can be archived in a separate historical branch or external backup

**Recommendation:** 
- Archive in a `/archive-2026-03` directory outside Git
- Remove `_archive/` from tracking: `git rm -r --cached _archive/`

#### `_zip_tmp/extracted/` Directory
**Contents:**
- Marketing/design assets extracted from Webflow export
- Fonts, CSS, images, JavaScript (extracted web dump)
- Over 100 extracted asset files

**Reasoning:**
- Temporary extraction directory
- Not source code or active project assets
- Includes external library code (jQuery, GSAP, Slick)
- Duplicates design files better stored in `public/origin/`
- Should be removed after extracting needed assets

**File Count Impact:**
- Approximately 120+ files in `_zip_tmp/extracted/`
- Represents ~25% of all tracked files
- Significantly reduces repository size if removed

**Recommendation:**
- Remove `_zip_tmp/extracted/` from tracking: `git rm -r --cached _zip_tmp/extracted/`
- Keep only extracted assets that are actively used
- Move reusable assets to appropriate `public/` folders

---

### ✓ VERIFIED LEGITIMATE PROJECT ASSETS

**Public Assets (Tracked):**
- `public/brand/` — logos and branding
- `public/login-assets/` — login UI assets
- `public/origin/` — extracted and integrated design assets
  - Contains fonts, images for the application
  - Part of active project presentation

**Documentation (Tracked):**
- `docs/dev-supabase.md` — Supabase development guide
- `docs/files-storage.md` — File storage documentation
- `docs/lune-operations-modules.md` — Operations module docs
- `docs/sql/field_installation.sql` — Database schema

---

## Summary of Changes Required

| Action | Files | Impact |
|--------|-------|--------|
| Remove from tracking | `_archive/`, `_zip_tmp/extracted/` | -~130 files, cleaner repo |
| Keep in tracking | 331 core files | Active project code |
| Already ignored | Build, deps, secrets | ✓ Verified |
| Improve documentation | README.md, docs/ | Better onboarding |

---

## Next Steps

1. **Move to release-cleanup branch** (if not already):
   ```bash
   git checkout -b release-cleanup
   ```

2. **Remove archived/temp directories from tracking:**
   ```bash
   git rm -r --cached _archive/
   git rm -r --cached _zip_tmp/extracted/
   ```

3. **Update .gitignore** to be explicit:
   ```gitignore
   # Legacy/archive files
   _archive/
   _zip_tmp/extracted/
   ```

4. **Commit cleanup:**
   ```bash
   git commit -m "chore: remove legacy archives and temporary extracted files from tracking"
   ```

5. **Verify final state:**
   ```bash
   git ls-files | wc -l  # Should be ~330 instead of 461
   ```

---

## Confidence Assessment

- **High Confidence** (Keep): Core src/, config files, docs
- **High Confidence** (Remove): _archive/, _zip_tmp/ (clearly legacy/temp)
- **Verified** (.gitignore): All build artifacts and secrets properly ignored

