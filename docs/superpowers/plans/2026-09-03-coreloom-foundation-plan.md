# Coreloom Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private founder-only Coreloom foundation for company-launch evidence, clients, projects, tasks, milestones, and the launch-first dashboard.

**Architecture:** Put the Next.js application in `apps/web` and keep the repository root for rules, manuals, and plans. Use Supabase Auth, Postgres, and private Storage. Every business record belongs to one founder workspace and is protected by RLS. Recho, PDF/email delivery, electronic signatures, and Popbill are separate plans after this foundation has stable client and project identifiers.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/Postgres/Storage, Vitest, Testing Library.

---

## Scope boundary

This plan delivers working private software: sign-in, launch preparation evidence, client and project registration, task progress, milestones, and the approved launch-first dashboard.

It does not deliver Recho ingestion, quote/PDF/email delivery, contract signing, revenue collection, Popbill, or AI summaries. Those modules must not be represented as available in the UI.

## Project file structure

```text
apps/web/
  src/app/(auth)/login/page.tsx
  src/app/(private)/layout.tsx
  src/app/(private)/dashboard/page.tsx
  src/app/(private)/setup/page.tsx
  src/app/(private)/clients/page.tsx
  src/app/(private)/projects/[projectId]/page.tsx
  src/app/actions/{auth,setup-items,documents,clients,projects}.ts
  src/components/{setup-item-form,document-upload,client-form,project-progress}.tsx
  src/lib/{auth,supabase,domain}/
  src/types/coreloom.ts
  tests/{setup,projects,progress,dashboard,workspace}.test.ts
  vitest.config.ts
supabase/migrations/  # created by the Supabase CLI
```

Before Task 2, create a founder-owned Supabase project and set only these values in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
CORELOOM_FOUNDER_EMAIL=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not put `SUPABASE_SERVICE_ROLE_KEY` or a Storage secret in browser variables or Git.

### Task 1: Bootstrap the isolated web app

**Files:**

- Create: `apps/web/` through the official generator
- Create: `apps/web/src/lib/domain/projects.ts`
- Create: `apps/web/tests/progress.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create the app without a nested Git repository**

Run:

```powershell
npx --yes create-next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --use-npm --disable-git --import-alias "@/*"
npm --prefix apps/web install @supabase/supabase-js @supabase/ssr zod
npm --prefix apps/web install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm --prefix apps/web pkg set scripts.test="vitest run" scripts.test:watch="vitest"
```

Expected: `apps/web/package.json` exists and the root `.git` remains the only Git directory.

- [ ] **Step 1a: Configure Vitest to resolve the app alias**

Create `apps/web/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node" },
});
```

- [ ] **Step 2: Write the failing progress test**

Create `apps/web/tests/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateProgress } from "@/lib/domain/projects";

describe("calculateProgress", () => {
  it("returns zero when a project has no tasks", () => {
    expect(calculateProgress([])).toBe(0);
  });

  it("rounds completed task progress to a whole percent", () => {
    expect(calculateProgress([{ completedAt: "2026-09-03" }, { completedAt: null }, { completedAt: null }])).toBe(33);
  });
});
```

Run: `npm --prefix apps/web test -- tests/progress.test.ts`

Expected: FAIL because the domain module does not exist.

- [ ] **Step 3: Implement the smallest calculation**

Create `apps/web/src/lib/domain/projects.ts`:

```ts
export type ProgressTask = { completedAt: string | null };

export function calculateProgress(tasks: ProgressTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.completedAt !== null).length / tasks.length) * 100);
}
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm --prefix apps/web test -- tests/progress.test.ts
npm --prefix apps/web run lint
git add apps/web .gitignore
git commit -m "feat: bootstrap Coreloom web foundation"
```

Expected: test and lint pass; no `.env.local` is staged.

### Task 2: Add founder authentication and workspace isolation

**Files:**

- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/admin.ts`
- Create: `apps/web/src/lib/auth/require-workspace.ts`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(private)/layout.tsx`
- Create: `apps/web/tests/workspace.test.ts`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Write the failing workspace guard test**

```ts
import { describe, expect, it } from "vitest";
import { workspaceIdFromMembership } from "@/lib/auth/require-workspace";

describe("workspaceIdFromMembership", () => {
  it("rejects a missing founder membership", () => {
    expect(() => workspaceIdFromMembership(null)).toThrow("Founder workspace is required");
  });
});
```

Run: `npm --prefix apps/web test -- tests/workspace.test.ts`

Expected: FAIL because the guard is missing.

- [ ] **Step 2: Add the typed guard**

Create `apps/web/src/lib/auth/require-workspace.ts`:

```ts
export type FounderMembership = { workspaceId: string; role: "founder" };

export function workspaceIdFromMembership(membership: FounderMembership | null): string {
  if (!membership) throw new Error("Founder workspace is required");
  return membership.workspaceId;
}
```

- [ ] **Step 3: Add Supabase clients, founder bootstrap, and route protection**

Use `createServerClient` from `@supabase/ssr` in `server.ts`, with only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Create `admin.ts` with a server-only `createClient` using `SUPABASE_SERVICE_ROLE_KEY`. It may be imported only from server actions.

The first signed-in user is allowed to create a workspace only when `user.email` exactly matches `CORELOOM_FOUNDER_EMAIL`. The bootstrap action first queries `workspace_members` by that user ID; if none exists, it creates one workspace named `Coreloom` and one membership with role `founder`. Any other authenticated email is signed out and shown “허용된 대표 계정이 아닙니다.” The private layout runs this bootstrap before calling `workspaceIdFromMembership`, then redirects an unauthenticated request to `/login`. The login form starts an email-based founder sign-in; no public registration page is rendered.

- [ ] **Step 4: Verify and commit**

```powershell
npm --prefix apps/web test -- tests/workspace.test.ts
npm --prefix apps/web run lint
git add apps/web
git commit -m "feat: add founder authentication boundary"
```

Expected: test and lint pass; browser code exposes no privileged key.

### Task 3: Create the workspace and private foundation schema

**Files:**

- Create: CLI-generated `supabase/migrations/*_coreloom_foundation.sql`
- Create: `apps/web/src/lib/domain/setup.ts`
- Create: `apps/web/tests/setup.test.ts`
- Create: `apps/web/src/types/coreloom.ts`

- [ ] **Step 1: Generate the migration through the CLI**

```powershell
npx --yes supabase@latest init
npx --yes supabase@latest migration new coreloom_foundation
```

Expected: one timestamped migration file is created. Keep the CLI-generated filename.

- [ ] **Step 2: Write the failing evidence validator test**

```ts
import { describe, expect, it } from "vitest";
import { validateSetupItem } from "@/lib/domain/setup";

describe("validateSetupItem", () => {
  it("requires evidence before completion", () => {
    expect(() => validateSetupItem({ title: "사업자 등록", completed: true, evidenceDocumentId: null })).toThrow("Evidence is required");
  });

  it("accepts a completed item with evidence", () => {
    expect(() => validateSetupItem({ title: "사업자 등록", completed: true, evidenceDocumentId: "doc-1" })).not.toThrow();
  });
});
```

- [ ] **Step 3: Implement the validator**

Create `apps/web/src/lib/domain/setup.ts`:

```ts
export type SetupItemInput = {
  title: string;
  completed: boolean;
  evidenceDocumentId: string | null;
};

export function validateSetupItem(input: SetupItemInput): void {
  if (!input.title.trim()) throw new Error("Title is required");
  if (input.completed && !input.evidenceDocumentId) throw new Error("Evidence is required");
}
```

- [ ] **Step 4: Define the migration**

Create tables `workspaces`, `workspace_members`, `audit_events`, `documents`, `setup_items`, `clients`, `client_contacts`, `projects`, `tasks`, and `milestones`. Each business table has `workspace_id uuid not null references workspaces(id)`, `created_at timestamptz not null default now()`, and `deleted_at timestamptz` for soft deletion. Enable RLS on every public table.

Every authenticated policy combines `TO authenticated` with a membership predicate:

```sql
exists (
  select 1
  from public.workspace_members membership
  where membership.workspace_id = workspace_id
    and membership.user_id = (select auth.uid())
)
```

The application must add an `audit_events` row after every create, update, completion, and soft delete.

- [ ] **Step 5: Verify and commit**

```powershell
npm --prefix apps/web test -- tests/setup.test.ts
npx --yes supabase@latest db lint
git add supabase apps/web
git commit -m "feat: add Coreloom foundation schema"
```

Expected: validator tests pass and database lint reports no security error. If no local or hosted Supabase connection exists, stop before applying any migration.

### Task 4: Implement private evidence and launch preparation

**Files:**

- Create: `apps/web/src/app/(private)/setup/page.tsx`
- Create: `apps/web/src/app/actions/setup-items.ts`
- Create: `apps/web/src/app/actions/documents.ts`
- Create: `apps/web/src/components/setup-item-form.tsx`
- Create: `apps/web/src/components/document-upload.tsx`

- [ ] **Step 1: Create private Storage**

Add a private `coreloom-documents` bucket. Its policies permit a signed-in workspace member to select, insert, update, and delete only objects beginning with that member's workspace ID. The upload action uses the path shape `workspace-id/random-uuid/original-file-name`; it creates a document row and audit event. Never make the bucket public.

- [ ] **Step 2: Implement setup actions**

`createSetupItem` calls `validateSetupItem`, writes a workspace-scoped row, and creates an audit event. `completeSetupItem` refuses a null `evidence_document_id`. `uploadDocument` refuses unauthenticated uploads and returns a document ID, not a public URL.

- [ ] **Step 3: Render the setup screen**

Render explicit labels for item name, evidence status, completion state, and last update. Disable completion until evidence is linked. Generate signed download URLs on the server only.

- [ ] **Step 4: Verify and commit**

```powershell
npm --prefix apps/web test -- tests/setup.test.ts
npm --prefix apps/web run lint
git add supabase apps/web
git commit -m "feat: add launch checklist and private evidence"
```

Expected: founder flow works after refresh: create item → upload evidence → complete item → open signed evidence link.

### Task 5: Implement clients, projects, tasks, milestones, and progress

**Files:**

- Create: `apps/web/src/app/(private)/clients/page.tsx`
- Create: `apps/web/src/app/(private)/projects/[projectId]/page.tsx`
- Create: `apps/web/src/app/actions/clients.ts`
- Create: `apps/web/src/app/actions/projects.ts`
- Create: `apps/web/src/components/client-form.tsx`
- Create: `apps/web/src/components/project-progress.tsx`

- [ ] **Step 1: Implement server actions**

`createClient` requires a legal name. `createProject` requires `clientId`, name, and ISO start date. `completeTask` writes `completed_at` once and creates an audit event. Every query and mutation uses the authenticated workspace ID; no action accepts a caller-supplied workspace ID.

- [ ] **Step 2: Render founder views**

The client page shows legal name, primary contact, project count, and last activity. The project page shows task status, milestone dates, progress from `calculateProgress`, and linked documents. Reserve the right rail with the explicit text “Recho 연결 전” rather than showing invented context data.

- [ ] **Step 3: Verify and commit**

```powershell
npm --prefix apps/web test -- tests/progress.test.ts
npm --prefix apps/web run lint
git add apps/web
git commit -m "feat: add clients projects and progress tracking"
```

Expected: founder can create a client and project, complete one task, refresh, and see the same rounded progress.

### Task 6: Render the approved launch-first dashboard

**Files:**

- Create: `apps/web/src/lib/domain/dashboard.ts`
- Create: `apps/web/src/app/(private)/dashboard/page.tsx`
- Create: `apps/web/src/components/dashboard/{launch-readiness,today-actions,project-list,revenue-placeholder}.tsx`
- Create: `apps/web/tests/dashboard.test.ts`

- [ ] **Step 1: Write the failing ordering test**

```ts
import { describe, expect, it } from "vitest";
import { dashboardSections } from "@/lib/domain/dashboard";

describe("dashboardSections", () => {
  it("keeps launch readiness before operating work", () => {
    expect(dashboardSections()).toEqual(["launch", "today", "projects", "revenue"]);
  });
});
```

- [ ] **Step 2: Implement the ordering rule**

```ts
export function dashboardSections() {
  return ["launch", "today", "projects", "revenue"] as const;
}
```

- [ ] **Step 3: Render each section with explicit state**

Display launch readiness first, then overdue tasks and milestones, active projects and progress, then a revenue card labeled “매출 원장 준비 중”. Do not display a fabricated zero currency total before billing records exist.

- [ ] **Step 4: Verify and commit**

```powershell
npm --prefix apps/web test -- tests/dashboard.test.ts
npm --prefix apps/web run lint
npm --prefix apps/web run build
git add apps/web
git commit -m "feat: add launch-first founder dashboard"
```

Expected: test, lint, and production build pass; the launch checklist visually precedes projects and revenue.

### Task 7: Record only the implemented state in the manual

**Files:**

- Modify: `manual/00-coreloom-매뉴얼.md`
- Modify: `manual/CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-09-03-coreloom-operating-os-design.md`

- [ ] **Step 1: Add the implemented-state section**

Name only these finished features: founder sign-in, setup evidence, private documents, clients, projects, tasks, milestones, and dashboard. Keep Recho, quotes, contracts, PDF/email, Popbill, and AI proposals labeled unimplemented.

- [ ] **Step 2: Record release evidence after deployment**

Record the production URL, release SHA, verification date, and this tested founder flow: sign in → upload evidence → complete setup item → create client → create project → complete task → observe dashboard progress.

- [ ] **Step 3: Verify and commit**

```powershell
git diff --check
git status --short
git add manual docs/superpowers/specs
git commit -m "docs: record Coreloom foundation release"
```

Expected: manuals do not claim unimplemented external integrations are live.

## Coverage self-review

| Approved design requirement | Plan coverage |
| --- | --- |
| Company launch evidence | Task 4 |
| Founder-only access and audit | Tasks 2–4 |
| Clients, projects, tasks, milestones, progress | Task 5 |
| Launch-first dashboard | Task 6 |
| Accurate operations manual | Task 7 |
| Recho, commercial documents, Popbill | Intentionally separated for follow-up plans with separate external authority |

## Plan self-review

- **Spec coverage:** Tasks 1–7 make the smallest usable company-operations foundation; external subsystems remain isolated.
- **Placeholder scan:** The plan defines every named function and gives commands and expected results for every task.
- **Type consistency:** `ProgressTask`, `FounderMembership`, and `SetupItemInput` are defined before use; task completion always uses `completedAt`.
