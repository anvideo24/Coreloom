# Coreloom Neon Access Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` one task at a time. Do not create a worktree or delegate by default. Read `RULES.md` and, for web changes, `apps/web/AGENTS.md` before each task.

**Status:** Approved plan only. This document does not enable Neon Auth, apply a migration, connect an AI tool to the database, or change a deployment.

**Goal:** Replace the obsolete Supabase path with the smallest safe Neon foundation: founder-only sign-in, server-only database access, versioned migrations, an auditable founder workspace, and a recoverable backup procedure.

**Architecture:** The Next.js server is the sole application component that connects to Neon Postgres. Neon Auth proves identity; Coreloom then verifies the identity email equals `CORELOOM_FOUNDER_EMAIL`. Drizzle schema files and generated SQL are committed. DSNs, auth endpoints, cookie secrets, production data, and backup archives never enter Git.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Neon Auth v0.2+, `@neondatabase/serverless`, Drizzle ORM/Kit, `tsx`, PostgreSQL `pg_dump`.

---

## Fixed boundaries

- Existing Coreloom Neon project in AWS Asia Pacific 1 (Singapore).
- `production` is the future operating-data branch. `ai-development` is persistent agent-assisted development and may hold synthetic test data only.
- Neon MCP, if connected later, may access `ai-development` only. It must never access `production`, customer data, finance data, documents, connection strings, or production-derived snapshots.
- A valid Neon Auth session is insufficient: server code must match the session email to `CORELOOM_FOUNDER_EMAIL` before every private read or write.
- No CI deployment, scheduler, Neon CLI login, API-key generation, migration, branch reset, Auth enablement, or production connection is included without a separate founder approval at action time.
- `2026-09-03-coreloom-foundation-plan.md` Task 1 remains complete. Its Tasks 2–7 are Supabase-specific and are superseded where this plan conflicts.

## Execution gates

| Gate | Founder action | Allowed after approval |
| --- | --- | --- |
| A — Auth preparation | Enable Neon Auth on empty `production`; select only the founder’s email login method. | Configure local-only auth variables. |
| B — Dev baseline | Confirm `ai-development` has no data to keep; reset it from `production`. | Development inherits the empty Auth baseline. |
| C — Dev migration | Put only the `ai-development` DSN in ignored `.env.local`; confirm branch in Console. | Generate/apply development migrations. |
| D — Production promotion | Review generated SQL and dev verification; approve the exact local production run. | A human-local command may migrate production. |
| E — Backup activation | Choose a private backup directory outside Git and confirm `pg_dump`. | Run/verify one manual logical backup. |

If `ai-development` has data at Gate B, stop; do not reset it. If Neon Auth cannot be enabled, stop and choose a dedicated identity provider—do not weaken the founder-only guard.

## Resulting structure

```text
apps/web/
  .env.example
  drizzle.config.ts
  drizzle/
  scripts/{migrate.ts,backup-production.ps1}
  src/app/api/auth/[...path]/route.ts
  src/app/(auth)/sign-in/page.tsx
  src/app/(private)/layout.tsx
  src/lib/auth/{server,founder}.ts
  src/lib/db/{config,client,schema,migrate}.ts
  src/lib/workspaces/founder-workspace.ts
  tests/{database-config,founder,migration-safety,founder-workspace}.test.ts
docs/operations/neon-branch-and-backup-runbook.md
```

## Task 1: Replace obsolete dependencies and create safe configuration contracts

**Files:** modify `apps/web/package.json`, `apps/web/package-lock.json`; create `apps/web/.env.example`, `apps/web/drizzle.config.ts`, `apps/web/src/lib/db/config.ts`, `apps/web/tests/database-config.test.ts`.

- [ ] **Step 1: Replace only database dependencies.**

```powershell
npm --prefix apps/web uninstall @supabase/ssr @supabase/supabase-js
npm --prefix apps/web install @neondatabase/auth @neondatabase/serverless drizzle-orm
npm --prefix apps/web install -D drizzle-kit tsx dotenv
```

Expected: no `@supabase/*` dependency remains and no connection value is printed.

- [ ] **Step 2: Write the failing configuration test.**

Create `apps/web/tests/database-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { requireDatabaseUrl } from "@/lib/db/config";

describe("requireDatabaseUrl", () => {
  it("fails closed when DATABASE_URL is absent", () => {
    expect(() => requireDatabaseUrl(undefined)).toThrow("DATABASE_URL is required");
  });
  it("rejects a non-Postgres value", () => {
    expect(() => requireDatabaseUrl("https://example.test")).toThrow("postgresql:// or postgres://");
  });
});
```

Run: `npm --prefix apps/web test -- tests/database-config.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add a server-only configuration guard.**

Create `apps/web/src/lib/db/config.ts`:

```ts
import "server-only";

export function requireDatabaseUrl(value = process.env.DATABASE_URL): string {
  if (!value) throw new Error("DATABASE_URL is required");
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must start with postgresql:// or postgres://");
  }
  return value;
}
```

Create `.env.example` with keys only: `DATABASE_URL=`, `CORELOOM_DATABASE_BRANCH=`, `NEON_AUTH_BASE_URL=`, `NEON_AUTH_COOKIE_SECRET=`, `CORELOOM_FOUNDER_EMAIL=`, `CORELOOM_BACKUP_DIR=`. `CORELOOM_DATABASE_BRANCH` is an explicit local declaration, not proof of the target; Gate C still requires the founder to verify the selected Neon branch in Console. Keep `.env.local` ignored.

Create `drizzle.config.ts` with `dialect: "postgresql"`, `schema: "./src/lib/db/schema.ts"`, `out: "./drizzle"`, `dbCredentials.url: process.env.DATABASE_URL ?? ""`, `strict: true`, and `verbose: true`. Add scripts `"db:generate": "drizzle-kit generate"` and `"db:migrate": "tsx scripts/migrate.ts"`.

- [ ] **Step 4: Verify and commit.**

```powershell
npm --prefix apps/web test -- tests/database-config.test.ts
npm --prefix apps/web run lint
git diff --check
git add apps/web/package.json apps/web/package-lock.json apps/web/.env.example apps/web/drizzle.config.ts apps/web/src/lib/db/config.ts apps/web/tests/database-config.test.ts
git commit -m "chore: prepare Neon database configuration"
```

Expected: test/lint pass and the staged diff contains no DSN, Auth base URL, or secret.

## Task 2: Add the founder identity boundary before private data exists

**Files:** create `apps/web/src/lib/auth/{server,founder}.ts`, `apps/web/src/app/api/auth/[...path]/route.ts`, `apps/web/src/app/(auth)/sign-in/page.tsx`, `apps/web/src/app/(private)/layout.tsx`, `apps/web/proxy.ts`, and `apps/web/tests/founder.test.ts`.

- [ ] **Step 1: Complete Gates A and B.** The founder enables Neon Auth, selects the intended email sign-in method, confirms `ai-development` is empty, then resets it from `production`. Put branch-specific values only in ignored `apps/web/.env.local`; generate a stable 32+ character cookie secret. Do not paste a DSN, Auth URL, secret, or real email into chat, Git, test values, screenshots, or terminal output.

- [ ] **Step 2: Write the failing pure founder test.**

```ts
import { describe, expect, it } from "vitest";
import { founderIdentityFromSession } from "@/lib/auth/founder";

describe("founderIdentityFromSession", () => {
  const founderEmail = "founder@example.test";
  it("returns the configured founder", () => {
    expect(founderIdentityFromSession({ id: "user-1", email: founderEmail }, founderEmail))
      .toEqual({ id: "user-1", email: founderEmail });
  });
  it("rejects a missing session", () => {
    expect(() => founderIdentityFromSession(null, founderEmail)).toThrow("Sign-in is required");
  });
  it("rejects another email", () => {
    expect(() => founderIdentityFromSession({ id: "user-2", email: "other@example.test" }, founderEmail))
      .toThrow("Founder account is required");
  });
});
```

Run: `npm --prefix apps/web test -- tests/founder.test.ts` — expected FAIL.

- [ ] **Step 3: Implement the rule and official SDK adapter.**

```ts
import "server-only";
export type AuthenticatedUser = { id: string; email: string };
export function founderIdentityFromSession(user: AuthenticatedUser | null, founderEmail = process.env.CORELOOM_FOUNDER_EMAIL): AuthenticatedUser {
  if (!user) throw new Error("Sign-in is required");
  if (!founderEmail || user.email.trim().toLowerCase() !== founderEmail.trim().toLowerCase()) {
    throw new Error("Founder account is required");
  }
  return user;
}
```

`src/lib/auth/server.ts` uses `createNeonAuth({ baseUrl: process.env.NEON_AUTH_BASE_URL!, cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! } })`. The auth route is `export const { GET, POST } = auth.handler()`.

Before writing the session adapter, inspect the installed SDK User type and use its verified email field; do not use `as any` or guess a property. The adapter calls `auth.getSession()` only on the server and passes only `{ id, email }` to the pure guard. `proxy.ts` uses `auth.middleware({ loginUrl: "/sign-in" })` for private routes. The private layout exports `dynamic = "force-dynamic"`, redirects no-session traffic, and denies a non-founder. The sign-in page uses the official Neon client SDK for only the Gate-A-selected method and shows no open registration path.

- [ ] **Step 4: Verify and commit.**

```powershell
npm --prefix apps/web test -- tests/founder.test.ts
npm --prefix apps/web run lint
npm --prefix apps/web run build
git add apps/web
git commit -m "feat: add founder-only Neon Auth boundary"
```

Expected: founder reaches a private placeholder on `ai-development`; no session redirects; other signed-in users receive no private response.

## Task 3: Add versioned workspace and audit schema on `ai-development` only

**Files:** create `apps/web/src/lib/db/{client,schema,migrate}.ts`, `apps/web/scripts/migrate.ts`, generated `apps/web/drizzle/*`, and `apps/web/tests/migration-safety.test.ts`.

- [ ] **Step 1: Write the failing migration-target test.**

```ts
import { describe, expect, it } from "vitest";
import { assertDevelopmentTarget } from "@/lib/db/migrate";

describe("assertDevelopmentTarget", () => {
  it("accepts the declared ai-development target", () => {
    expect(() => assertDevelopmentTarget("ai-development")).not.toThrow();
  });
  it("refuses a production or missing target declaration", () => {
    expect(() => assertDevelopmentTarget("production")).toThrow("ai-development");
    expect(() => assertDevelopmentTarget(undefined)).toThrow("ai-development");
  });
});
```

Run: `npm --prefix apps/web test -- tests/migration-safety.test.ts` — expected FAIL.

- [ ] **Step 2: Define only access-foundation tables.** `workspaces` has UUID, non-empty name, timestamps, and soft deletion; `workspace_members` has UUID, workspace foreign key, unique Neon Auth user ID text, a role constrained to `founder`, and timestamps; `audit_events` has UUID, workspace foreign key, actor user ID text, non-empty event type, JSON payload excluding secrets/raw documents, immutable created time. Add one-active-founder-per-workspace and `audit_events(workspace_id, created_at desc)`. Do not add customer, project, document, contract, money, Recho, or AI tables.

- [ ] **Step 3: Implement the server-only client and migration guard.** `client.ts` begins `import "server-only"` and uses `neon(requireDatabaseUrl())` plus Drizzle. It is imported only by server components, route handlers, or server actions.

```ts
export function assertDevelopmentTarget(branch = process.env.CORELOOM_DATABASE_BRANCH): void {
  if (branch !== "ai-development") {
    throw new Error("Migration target must be the ai-development branch");
  }
}
```

`scripts/migrate.ts` loads local env, runs this guard before Drizzle migrator, and never logs the URL. A Neon connection string does not reliably expose the friendly branch name, so this guard is deliberately paired with the required manual Console confirmation in Gate C; it is not presented as proof of branch identity. Generate SQL with `db:generate`, inspect it, and run `db:migrate` only after Gate C confirms branch in Console. Do not promise Postgres RLS yet: the single server credential could bypass it. Current authorization is server-side founder verification, server-assigned `workspace_id`, and audit history. A non-bypass role plus per-request claims is a future separate plan.

- [ ] **Step 4: Verify and commit.**

```powershell
npm --prefix apps/web test -- tests/migration-safety.test.ts
npm --prefix apps/web run db:generate
npm --prefix apps/web run db:migrate
npm --prefix apps/web run lint
git add apps/web
git commit -m "feat: add Neon workspace migration foundation"
```

Expected: committed generated SQL and migration ledger plus three empty tables on `ai-development` only. Confirm names manually in Neon Console without copying data into chat.

## Task 4: Create an auditable founder workspace bootstrap

**Files:** create `apps/web/src/lib/workspaces/founder-workspace.ts`, `apps/web/tests/founder-workspace.test.ts`; modify private layout.

- [ ] **Step 1: Write failing tests against a fake repository.** Cover: (1) first verified founder gets one workspace, membership, and `workspace.created` audit event; (2) repeat request creates none; (3) non-founder is rejected before repository call. Run `npm --prefix apps/web test -- tests/founder-workspace.test.ts` and expect FAIL.

- [ ] **Step 2: Implement idempotently.** `ensureFounderWorkspace(founder, repository)` calls the founder guard, finds active membership by Auth user ID, then when absent creates `Coreloom`, founder membership, and audit event in one transaction. It never accepts workspace ID from route, form, or client. Repository methods are only `findActiveMembershipByUserId`, `createFounderWorkspace`, and `transaction`; no page/action composes arbitrary SQL.

- [ ] **Step 3: Verify and commit.**

```powershell
npm --prefix apps/web test -- tests/founder-workspace.test.ts
npm --prefix apps/web run lint
npm --prefix apps/web run build
git add apps/web
git commit -m "feat: bootstrap auditable founder workspace"
```

Expected: first/repeat login is idempotent in development, input cannot choose workspace, and no UI prints raw audit JSON.

## Task 5: Add founder-run backup and production-promotion runbook

**Files:** create `apps/web/scripts/backup-production.ps1`, `docs/operations/neon-branch-and-backup-runbook.md`; modify `manual/00-coreloom-매뉴얼.md`, `manual/CHANGELOG.md`.

- [ ] **Step 1: Implement a fail-closed backup script.** It requires `DATABASE_URL` and `CORELOOM_BACKUP_DIR`; rejects empty, relative, repository-inside, or root-drive backup paths; requires `pg_dump`; creates custom archive `coreloom-production-YYYYMMDD-HHmmss.dump`; runs `pg_restore --list` without printing rows/DSN; and writes only filename, byte length, UTC time, and verification result to a sibling receipt. It does not delete backups, upload data, create a scheduler, or run automatically. Encryption/remote replication await a separately selected retention/storage policy.

- [ ] **Step 2: Write the runbook.** State: development is synthetic-only; production is never exposed to AI/MCP; migration is generated SQL → review → dev apply/test → commit/push → founder-approved local production command; stop if target branch/DSN/SQL differs; short Neon Free recovery history is not a backup; manually back up after an approved production schema change and before destructive maintenance; restore drills go to a new non-production branch first; any production restore needs distinct approval.

- [ ] **Step 3: Verify and commit.** First run without environment variables and verify it exits before `pg_dump`. Only after Gate E, run one founder-local production backup and inspect receipt metadata only.

```powershell
pwsh -File apps/web/scripts/backup-production.ps1
git diff --check
git add apps/web/scripts/backup-production.ps1 docs/operations/neon-branch-and-backup-runbook.md manual/00-coreloom-매뉴얼.md manual/CHANGELOG.md
git commit -m "docs: add Neon backup and promotion runbook"
```

Expected: no-env invocation fails closed; Gate E produces one verified archive outside Git; docs claim manual procedure only, not automatic backup or integrations.

## Task 6: Record proof before ERP features resume

**Files:** modify `docs/superpowers/specs/2026-09-03-coreloom-operating-os-design.md` and `manual/CHANGELOG.md`.

- [ ] **Step 1: Record verified facts only.** After earlier tasks and separately approved production migration, record commit SHA, verification date, branch roles, founder-login result, workspace-bootstrap result, and backup receipt filename—never path/content. Keep evidence docs, clients, projects, money, Recho, contracts, email, PDF, tax invoicing, and AI proposals explicitly unimplemented.

- [ ] **Step 2: Verify one development flow.** On `ai-development`: founder sign-in → first private request creates one workspace/audit event → refresh duplicates neither → non-founder test account denied. Verify production migration/backup only if Gates D/E ran; otherwise record `보류`.

- [ ] **Step 3: Commit.**

```powershell
git diff --check
git add docs/superpowers/specs/2026-09-03-coreloom-operating-os-design.md manual/CHANGELOG.md
git commit -m "docs: record verified Neon access foundation"
```

Expected: docs state verified reality only; the next plan can add setup evidence, clients, projects, tasks, and commercial modules.

## Plan self-review

| Requirement | Coverage |
| --- | --- |
| Founder login | Task 2: Neon Auth v0.2 plus exact founder-email guard |
| AI cannot reach production | Fixed boundaries, Gates C–D, runbook |
| Safe migration | Tasks 1/3: committed SQL plus development target guard |
| Workspace/audit | Task 4 |
| Recovery | Task 5: logical archive plus non-production restore drill |
| Sensitive data | Ignored env, server-only DB client, no archive in Git |
| ERP scope | Customer/financial/document/Recho modules intentionally deferred |

## Sources

- Neon [Auth v0.2 migration guide](https://neon.com/docs/auth/migrate/from-auth-v0.1): `createNeonAuth`, handler/middleware/session API, stable cookie-secret, and dynamic route requirements.
- Neon [serverless driver documentation](https://neon.com/docs/serverless/serverless-driver): serverless connection usage and owner-role/RLS warning.
- Neon [branches guide](https://neon.com/docs/get-started/signing-up): development branch reset; this plan adds an empty-data confirmation before that destructive action.
