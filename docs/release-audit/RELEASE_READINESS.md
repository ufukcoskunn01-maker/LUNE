# Release Readiness

Date: 2026-03-03  
Branch: `fix/typecheck-build-baseline`

## Scope
Conservative release-readiness improvements only:
- warning reduction
- env/config hygiene
- line-ending policy
- route presence verification

No feature redesign, no business-logic refactor.

## Issues Fixed

### 1) Middleware deprecation warning
- Problem: Next.js warned that `middleware` convention is deprecated in favor of `proxy`.
- Fix:
  - Removed `src/middleware.ts`
  - Added `src/proxy.ts` with equivalent auth-gating logic
  - Removed duplicate root-level `middleware.ts`/`proxy.ts` artifacts to keep a single runtime entrypoint
- Risk: low (behavior preserved; naming convention update only).

### 2) Recharts build-time width/height warnings
- Problem: build emitted repeated `width(-1) and height(-1)` warnings from `ResponsiveContainer`.
- Fix: added client-ready wrappers (using `useSyncExternalStore`) so chart containers render only when client layout is available.
  - `src/components/apex/charts.tsx`
  - `src/components/apex/live-graphics.tsx`
  - `src/components/personal/TransportationWorkspace.tsx`
- Risk: low (presentation timing only; no data/business logic changes).

### 3) Environment template completeness
- Problem: `.env.example` was missing several variables actually used by runtime code.
- Fix: expanded `.env.example` to include all currently referenced env vars and grouped by concern.
- Verification: used-vs-defined comparison now has no missing keys.

### 4) Line ending policy
- Problem: repeated LF/CRLF noise and no repo policy file.
- Fix: added `.gitattributes` with:
  - `* text=auto eol=lf`
  - common binary extensions marked `binary`
- Risk: low; improves consistency across platforms.

## Issues Deferred (Intentional)

### PostCSS dual config files
- Files:
  - `postcss.config.js`
  - `postcss.config.mjs`
- Observation: both exist and differ in plugin set.
- Decision: deferred removal/merge for this pass to avoid toolchain risk before release cut.
- Manual follow-up: decide canonical config format (`.js` vs `.mjs`) and consolidate in a dedicated config PR.

### Non-blocking lint warning
- `scripts/reimport-field-installation-all.mjs`: unused `pickSheet`.
- Decision: deferred (script-only, non-release-blocking, no runtime impact).

## Core Route Verification
Verified via successful production build route manifest and source checks:
- `/login` (and auth pages) present
- `/dashboard` present
- `/control-tower` present
- `/warehouse` present
- `/documents` present
- `/reports` present
- `/schedule-comparison` present
- `/ai` present
- `/daily-installation-reports` present

## Validation Results
- `npm run lint`: pass (1 warning, 0 errors)
- `npm run typecheck`: pass
- `npm run build`: pass
  - middleware deprecation warning: resolved
  - Recharts width/height warnings: resolved

## Manual Decisions Still Needed
1. PostCSS config consolidation strategy (`postcss.config.js` vs `postcss.config.mjs`).
2. Whether to enforce stricter lint policy on scripts before release (`warnings as errors` vs current).

## Final Recommendation
Repository is suitable for a controlled release-candidate branch with current scope and known deferred items documented above.
