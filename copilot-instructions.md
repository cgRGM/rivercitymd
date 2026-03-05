# Copilot Implementation Instructions (River City MD)

This file defines how coding assistants should execute work in this repo. For broader process context, see `agents.md`.

## First Action on Any Task: Inspect `.agents`

Before planning or code generation:

1. Inspect `.agents/skills/`.
2. Open relevant `SKILL.md` files.
3. Apply those instructions to architecture, implementation, validation, and testing.

Do not skip `.agents` lookup.

## GitHub Workflow You Must Follow

Treat GitHub as the planning and status layer. Required loop:

1. Plan.
2. Create/find issue.
3. Create feature branch.
4. Implement.
5. Test.
6. Open PR.
7. Review.
8. Merge to `main` (or `develop` then `main` if present).
9. Close issue.

Always develop on a feature/fix/chore branch, never directly on `main`.

## Issue Requirements

Use these templates:

- `.github/ISSUE_TEMPLATE/feature.yml`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/chore.yml`

Issue requirements:

- Title format:
  - `feat: ...`
  - `fix: ...`
  - `chore: ...`
- Problem/goal description.
- Acceptance criteria checklist.
- Optional `.agents` references for implementation context.

## Branch Naming Rules (Required)

- `feat/<slug>-<issueNumber>`
- `fix/<slug>-<issueNumber>`
- `chore/<slug>-<issueNumber>`

Examples:

- `feat/customer-onboarding-reminder-221`
- `fix/stripe-webhook-signature-224`
- `chore/refactor-convex-tests-219`

## Pull Request Rules (Required)

Use `.github/pull_request_template.md`.

PR title:

- Mirror issue title style (`feat: ...`, `fix: ...`, `chore: ...`).

PR body must include:

- Summary
- Implementation notes
- Testing notes
- `Closes #<issueNumber>`

## GitHub Project Board Rules

Use/assume a board with:

- `Backlog`
- `In Progress`
- `In Review`
- `Done`

Status mapping:

- Issue created -> `Backlog`
- Branch created + work started -> `In Progress`
- PR opened -> `In Review`
- PR merged + issue closed -> `Done`

When you create or modify an issue/PR, keep the board status synchronized.

## Repo-Aware Architecture Expectations

- Frontend: Next.js App Router in `app/`
- Components: `components/` and `components/ui/`
- Backend: Convex domain modules in `convex/`
- Data model: `convex/schema.ts`
- Tests: Vitest + `convex/*.test.ts`
- CI: `.github/workflows/test.yml` runs lint/build/test

## Skill Routing Guide

| Task Type | Primary Skill Path | Use Also |
|---|---|---|
| Convex backend function changes | `.agents/skills/convex-functions/` | `.agents/skills/convex-best-practices/`, `.agents/skills/convex-security-check/` |
| Schema/index/data model changes | `.agents/skills/convex-schema-validator/` | `.agents/skills/convex-migrations/` |
| Realtime UI + optimistic updates | `.agents/skills/convex-realtime/` | `.agents/skills/vercel-react-best-practices/` |
| Webhooks/API routes (`convex/http.ts`) | `.agents/skills/convex-http-actions/` | `.agents/skills/convex-security-audit/` |
| File upload/storage flows | `.agents/skills/convex-file-storage/` | `.agents/skills/convex-functions/` |
| Scheduled jobs (`convex/crons.ts`) | `.agents/skills/convex-cron-jobs/` | `.agents/skills/convex-best-practices/` |
| AI-agent features in Convex | `.agents/skills/convex-agents/` | `.agents/skills/convex-security-audit/` |
| Reusable Convex module/component work | `.agents/skills/convex-component-authoring/` | `.agents/skills/convex/` |
| Security review pass | `.agents/skills/convex-security-check/` | `.agents/skills/convex-security-audit/` |
| React/Next performance work | `.agents/skills/vercel-react-best-practices/` | `.agents/skills/vercel-react-best-practices/rules/` |
| UI redesign/new page aesthetics | `.agents/skills/frontend-design/` | `.agents/skills/vercel-react-best-practices/` |
| Scope control | `.agents/skills/avoid-feature-creep/` | `agents.md` |
| Missing capability discovery | `.agents/skills/find-skills/` | N/A |

## Existing Repo Conventions to Follow

- Frontend auth: Clerk hooks/components (`@clerk/nextjs`).
- Backend auth: `ctx.auth.getUserIdentity()`.
- User linkage: Convex `users` records keyed by `clerkUserId`.
- Schema-first: update `convex/schema.ts` before/with backend logic.
- Query efficiency: prefer `.withIndex(...)`.
- Validation: explicit validators for args and returns.
- User-facing backend errors: `ConvexError`.

## Validation Before PR

Run relevant checks:

- `pnpm lint`
- `pnpm build`
- `pnpm test` (or targeted suite)

## Automation Rules

Implemented in this repo:

- `.github/workflows/pr-conventions.yml` enforces:
  - Branch name: `feat|fix|chore/<slug>-<issueNumber>`
  - PR title prefix: `feat:`, `fix:`, or `chore:`
  - PR body sections and `Closes #<issueNumber>`

Recommended board automation (configure in GitHub Project workflows/Actions):

- Auto-add new issues -> `Backlog`
- Auto-move linked issue -> `In Review` on PR open
- Auto-move issue -> `Done` on merge + close
- Auto-label type/state from issue templates

## Documentation Sync Requirement

If workflow or `.agents` structure changes, update in the same PR:

- `agents.md`
- `copilot-instructions.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
