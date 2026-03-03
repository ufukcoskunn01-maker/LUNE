# Missing or Uncertain Files

**Date**: 2026-03-03  
**Status**: Audit findings for required repository files

---

## Files Verified as PRESENT ✓

All core project files are accounted for and properly tracked:

- ✓ `package.json` — Present, has 57 lines, includes dev scripts
- ✓ `package-lock.json` — Present, locked dependency versions
- ✓ `tsconfig.json` — Present, TypeScript configuration
- ✓ `next.config.ts` — Present, Next.js configuration
- ✓ `postcss.config.mjs` — Present, PostCSS pipeline config
- ✓ `tailwind.config.js` — Present, Tailwind CSS config
- ✓ `eslint.config.mjs` — Present, ESLint linting rules
- ✓ `components.json` — Present, shadcn/ui component alias config
- ✓ `.gitignore` — Present, 43 lines of proper Next.js ignores
- ✓ `.env.example` — Present, environment template for developers
- ✓ `README.md` — Present, but generic boilerplate
- ✓ `middleware.ts` — Present, at both src/ and root (symlink/duplicate)
- ✓ `.next/` — Build output (not tracked, properly ignored)
- ✓ `src/app/` — Next.js App Router (60+ route files)
- ✓ `src/components/` — React components (80+ files)
- ✓ `src/lib/` — Utilities and services (40+ files)
- ✓ `src/types/database.types.ts` — Supabase auto-generated types
- ✓ `supabase/migrations/` — Database migrations (11 files)
- ✓ `docs/` — Project documentation (6 files)
- ✓ `scripts/` — Utility scripts (15 files)
- ✓ `public/` — Static assets (280+ files)

---

## Files MISSING or UNCERTAIN ⚠️

### Category: RECOMMENDED BUT MISSING (Low Confidence)

#### 1. `ARCHITECTURE.md`
**Why it seems required:**
- Complex project with multiple modules (attendance, field-installation, scheduling, etc.)
- New developers need to understand system design
- Multiple API routes and data flows not immediately obvious

**Why confidence is low:**
- Project may be documented elsewhere (in other docs files)
- Architecture may be self-evident from file structure
- Could be intentionally undocumented

**Recommended action:**
- Review `docs/lune-operations-modules.md` — does it explain architecture?
- If not, create `docs/ARCHITECTURE.md` describing:
  - Data flow diagrams
  - Module relationships
  - API route organization
  - Authentication flow

**Suggested location**: `docs/ARCHITECTURE.md`

---

#### 2. `CONTRIBUTING.md`
**Why it seems required:**
- Open or collaborative development
- GitHub repo suggests public/team collaboration
- No guidelines for contributors, PRs, or branching

**Why confidence is low:**
- Could be internal-only project
- May not need external contributions
- Contributing rules might be informal/verbal

**Recommended action:**
- If this is a team project, create `CONTRIBUTING.md` with:
  - Branch naming conventions
  - PR review requirements
  - Commit message format
  - Testing requirements before merge
  - Linting and type-checking requirements

**Suggested location**: `CONTRIBUTING.md` (root)

---

#### 3. `DEPLOYMENT.md`
**Why it seems required:**
- Project uses Vercel (indicated by `vercel.json`)
- Multiple environment variables needed
- Database setup (Supabase) is complex
- Developers and ops need deployment procedures

**Why confidence is low:**
- Deployment might be documented in internal wiki
- `vercel.json` might contain all necessary Vercel config
- Environment variables might be set via web admin panel

**Recommended action:**
- If this is a production project, create `docs/DEPLOYMENT.md` with:
  - Vercel deployment steps
  - Environment variable setup checklist
  - Supabase migration procedure
  - Database backup/restore procedures
  - Secrets management (GitHub/Vercel)
  - Rollback procedures

**Suggested location**: `docs/DEPLOYMENT.md`

---

#### 4. `Dockerfile` and `.dockerignore`
**Why it seems required:**
- Production Next.js apps are often containerized
- Makes CI/CD and local dev environments consistent
- Required for modern deployment platforms (Docker, K8s, etc.)

**Why confidence is low:**
- Vercel handles deployment natively (doesn't need Docker)
- If Vercel is primary deployment, Docker may not be needed
- Docker setup might be in separate DevOps repository

**Recommended action:**
- If containerized deployment is planned:
  - Create `Dockerfile` for Node.js + Next.js
  - Create `.dockerignore` to exclude build artifacts
- Otherwise, skip for Vercel-only deployment

**Suggested location**: `Dockerfile`, `.dockerignore` (root)

---

#### 5. `SECURITY.md`
**Why it seems required:**
- Handles authentication and user data (Supabase)
- Manages file uploads/storage
- Handles sensitive project/attendance data

**Why confidence is low:**
- Security might be documented in internal security policies
- Supabase handles auth security (not app's responsibility)
- Could be stored in separate security documentation

**Recommended action:**
- Create `docs/SECURITY.md` documenting:
  - How authentication works (Supabase + middleware)
  - How secrets are managed (.env files, GitHub Secrets)
  - Upload/storage security practices
  - Data access controls
  - Vulnerability reporting procedures

**Suggested location**: `docs/SECURITY.md`

---

#### 6. `API.md` or API Documentation
**Why it seems required:**
- 40+ API routes in `src/app/api/`
- No clear documentation of endpoints, parameters, responses
- Makes onboarding developers slower

**Why confidence is low:**
- API documentation might be generated from OpenAPI/Swagger
- Could be documented in external tool (Postman, etc.)
- API routes might be self-documenting via code

**Recommended action:**
- Create `docs/API.md` with sections for:
  - Authentication endpoints
  - Attendance endpoints (list, list details, export, import)
  - Field installation endpoints
  - Field reports endpoints
  - Schedule endpoints
  - Each with: method, path, parameters, response example

**Suggested location**: `docs/API.md`

---

#### 7. `.npmrc`
**Why it seems required:**
- If using private npm packages
- If custom npm registry is needed
- If npm version pinning is required

**Why confidence is low:**
- Project appears to use only public npm packages
- `.npmrc` might not be necessary

**Recommended action:**
- If using private packages: Create `.npmrc` at project root
- Otherwise, not needed

**Suggested location**: `.npmrc` (optional, root)

---

#### 8. `jest.config.js` or test configuration
**Why it seems required:**
- Only 1 test file exists (`tests/ci-smoke.test.mjs`)
- Using `node --test` suggests native test runner
- For larger projects, Jest or Vitest is typical

**Why confidence is low:**
- Project may intentionally use minimal testing
- Native Node test runner is valid choice
- Full test suite might not be needed yet

**Recommended action:**
- Review current testing approach
- If expanding tests, consider Jest or Vitest config
- For now, current approach is acceptable

**Suggested location**: `jest.config.js` or `vitest.config.ts` (optional)

---

#### 9. `.env.example` completeness
**Why it seems required:**
- Present, but may be incomplete
- Developers need all environment variables listed

**Why confidence is low:**
- File exists, exact contents not verified
- Might be comprehensive already

**Recommended action:**
- Review `.env.example`
- Ensure all required variables are documented:
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - API keys for external services
  - Feature flags

**Suggested location**: `.env.example` (update existing)

---

#### 10. `renovate.json` or Dependabot config
**Why it seems required:**
- Keeping dependencies updated is critical
- Prevents security vulnerabilities

**Why confidence is low:**
- GitHub Dependabot might have default config
- Renovate might be overkill for this project
- Dependencies might be manually managed

**Recommended action:**
- Consider enabling GitHub Dependabot for security updates
- Create `.github/dependabot.yml` if not auto-enabled

**Suggested location**: `.github/dependabot.yml` (optional)

---

## Files to EXCLUDE (Not Needed)

The following are NOT necessary for this project:

- 🚫 `requirements.txt` — Python-only, not needed (Node project)
- 🚫 `Gemfile` — Ruby-only, not needed
- 🚫 `go.mod` — Go-only, not needed
- 🚫 `pom.xml` — Java-only, not needed
- 🚫 `pyproject.toml` — Python-only, not needed
- 🚫 `Cargo.toml` — Rust-only, not needed

---

## Summary Table

| File | Present | Required | Confidence | Recommendation |
|------|---------|----------|-----------|-----------------|
| package.json | ✓ | ✓ | High | Keep |
| tsconfig.json | ✓ | ✓ | High | Keep |
| next.config.ts | ✓ | ✓ | High | Keep |
| .gitignore | ✓ | ✓ | High | Keep |
| .env.example | ✓ | ✓ | High | Verify completeness |
| README.md | ✓ | ✓ | High | Update (replace boilerplate) |
| ARCHITECTURE.md | ✗ | ~ | Medium | Create if documenting system |
| CONTRIBUTING.md | ✗ | ~ | Medium | Create if collaborative |
| DEPLOYMENT.md | ✗ | ~ | Medium | Create for ops guide |
| API.md | ✗ | ~ | Low | Create for large API |
| Dockerfile | ✗ | ? | Low | Create if containerizing |
| SECURITY.md | ✗ | ~ | Low | Create if sharing code externally |

---

## Verification Commands (for you to run)

```bash
# Check what's in .env.example
cat .env.example

# List all routes to understand API coverage
find src/app/api -type f -name "route.ts" | sort

# Count test files
find tests -type f -name "*.test.*" | wc -l

# Check if any docs need updates
ls -lah docs/
```

---

## Final Assessment

**Confidence Level**: HIGH that all REQUIRED files are present
**Confidence Level**: MEDIUM that documentation should be improved
**Recommendation**: 

1. Update `README.md` to be project-specific
2. Improve `.env.example` documentation
3. Consider adding `CONTRIBUTING.md` and `DEPLOYMENT.md` if this is production

**No blocking issues**: Repository is ready for release with documentation improvements.


---

## Step 5 Verification Notes (2026-03-03)

### Resolved
- `templates/` is **not missing/uncertain**: it is actively used by `src/app/api/attendance/export-monthly-hours/route.ts` as local fallback template input.
- Active PostCSS config selection is now clear: `postcss.config.js` is selected before `postcss.config.mjs` by Next.js config discovery order.

### Remaining Uncertain (Do Not Remove Blindly)
- `postcss.config.mjs`: likely redundant because `.js` is preferred and both exist, but removal should be in a dedicated cleanup commit after one successful local build/lint cycle with only `.js` retained.
- `_archive/*`: already untracked from Git index; keep local files until final team confirmation that no historical recovery is needed.

### Current Recommendation
- Keep `postcss.config.js` as canonical.
- Keep `templates/` tracked.
- Plan separate low-risk commit to remove redundant `postcss.config.mjs` after explicit verification run.
