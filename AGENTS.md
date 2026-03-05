# River City MD Agent Operating Guide

GitHub is the source of truth for planning and status. Agents must not manage delivery state only in local context.

## Non-Negotiable Delivery Loop

Every work item follows this loop:

1. Plan.
2. Create issue.
3. Create feature branch.
4. Implement.
5. Test.
6. Open PR.
7. Review.
8. Merge to `main` (or `develop` then `main` if that flow exists).
9. Close issue.

No direct implementation on `main`.

## GitHub Workflow to Create and Enforce

### 1) Issues (Required)

Use the issue templates in `.github/ISSUE_TEMPLATE/`:

- `feature.yml`
- `bug.yml`
- `chore.yml`

Each issue must include:

- Title prefix:
  - `feat: ...`
  - `fix: ...`
  - `chore: ...`
- Problem/goal description.
- Acceptance criteria checklist.
- Optional links to relevant `.agents` files.

### 2) Branching Rules (Required)

Branch from `main` unless the repo is explicitly using `develop` as integration.

Required branch naming:

- `feat/<slug>-<issueNumber>`
- `fix/<slug>-<issueNumber>`
- `chore/<slug>-<issueNumber>`

Examples:

- `feat/admin-trip-log-filters-142`
- `fix/payment-intent-timeout-203`
- `chore/update-convex-tests-187`

### 3) Pull Requests (Required)

Use `.github/pull_request_template.md`.

PR title:

- Mirror issue title style (`feat: ...`, `fix: ...`, `chore: ...`).

PR body must include:

- Summary.
- Implementation notes.
- Testing notes.
- `Closes #<issueNumber>`.

### 4) GitHub Project Board (Required)

Use one GitHub Project board for this repo with columns:

- `Backlog`
- `In Progress`
- `In Review`
- `Done`

State transitions:

- Issue created -> `Backlog`
- Branch created and coding started -> `In Progress`
- PR opened -> `In Review`
- PR merged and issue closed -> `Done`

Agents must keep card state current whenever they create or modify an issue/PR.

## Project Reality (Current Repo Layout)

- Frontend: Next.js App Router in `app/`
- Shared UI/components: `components/` (includes `components/ui`, admin, dashboard, home)
- Backend/business logic: Convex domain modules in `convex/`
- Data model: `convex/schema.ts`
- Tests: Vitest and `convex/*.test.ts`
- CI: `.github/workflows/test.yml` runs lint, build, test on push/PR
- Agent skill system: `.agents/skills/*`

## `.agents` Is the First Stop Before Planning or Coding

Before creating a plan or writing code:

1. Inspect `.agents/skills/`.
2. Open relevant `SKILL.md`.
3. Follow any linked companion docs (`AGENTS.md`, `rules/*.md`, `LICENSE.txt`, etc.).

## Domain Chronicle (`.agents/skills`)

| Domain / Skill | Path | Purpose | Supports | Consult When | Related Files |
|---|---|---|---|---|---|
| Scope control | `.agents/skills/avoid-feature-creep/` | Prevent unnecessary scope growth | MVP scoping, backlog control, feature triage | Requests add “one more feature” or scope drifts | `SKILL.md` |
| Skill discovery | `.agents/skills/find-skills/` | Find/install additional external skills | Capability discovery and extension | Local skills do not cover the request | `SKILL.md` |
| Frontend design | `.agents/skills/frontend-design/` | Distinctive, production-quality UI | Page/component styling and UX polish | Building/redesigning UI | `SKILL.md`, `LICENSE.txt` |
| React/Next performance | `.agents/skills/vercel-react-best-practices/` | React/Next performance guidance | Refactors, bundle/render/data-flow tuning | Touching React/Next behavior or perf | `SKILL.md`, `AGENTS.md`, `rules/*.md` |
| Convex umbrella index | `.agents/skills/convex/` | Routes to Convex sub-skills | Picking correct Convex guidance | Any backend/data task in `convex/` | `SKILL.md` |
| Convex function patterns | `.agents/skills/convex-functions/` | Query/mutation/action/http patterns | Backend function design | Writing/updating Convex functions | `SKILL.md` |
| Convex schema + validation | `.agents/skills/convex-schema-validator/` | Schema modeling and validators | Table/index design | Changing `convex/schema.ts` | `SKILL.md` |
| Convex best practices | `.agents/skills/convex-best-practices/` | Production Convex patterns | Organization, idempotency, errors | Any substantial Convex change | `SKILL.md` |
| Convex realtime | `.agents/skills/convex-realtime/` | Subscription/optimistic patterns | Reactive UX and pagination | Realtime behavior changes | `SKILL.md` |
| Convex HTTP actions | `.agents/skills/convex-http-actions/` | Webhooks/API endpoints | Routing, CORS, signatures | Editing `convex/http.ts` | `SKILL.md` |
| Convex file storage | `.agents/skills/convex-file-storage/` | Upload/storage/serving patterns | Media/file workflows | Handling files in Convex | `SKILL.md` |
| Convex migrations | `.agents/skills/convex-migrations/` | Safe schema/data evolution | Backfills and migrations | Evolving live schema/data | `SKILL.md` |
| Convex security quick check | `.agents/skills/convex-security-check/` | Security checklist | Fast auth/access validation | Pre-merge security pass | `SKILL.md` |
| Convex security deep audit | `.agents/skills/convex-security-audit/` | Deep security review | Authorization/data boundary audit | High-risk auth/payment/admin changes | `SKILL.md` |
| Convex agents | `.agents/skills/convex-agents/` | Stateful AI agents with Convex | Threads, tools, streaming, RAG | Building AI agent features | `SKILL.md` |
| Convex cron jobs | `.agents/skills/convex-cron-jobs/` | Scheduled/background execution | Intervals, cron expressions, retries | Editing `convex/crons.ts` | `SKILL.md` |
| Convex component authoring | `.agents/skills/convex-component-authoring/` | Reusable Convex components | Packaging and isolation | Authoring reusable modules | `SKILL.md` |

## Repo Conventions to Preserve

- Authentication:
  - Frontend: Clerk hooks/components.
  - Backend: `ctx.auth.getUserIdentity()`.
  - User linkage: Convex `users` via `clerkUserId`.
- Schema-first changes: update `convex/schema.ts` first or together with logic.
- Query performance: prefer indexed queries (`withIndex`) over broad filters.
- Validation: explicit validators for function args and returns.
- User-visible backend errors: use `ConvexError`.

## Automation Status

Implemented in-repo:

- `.github/workflows/pr-conventions.yml` enforces:
  - Branch name pattern: `^(feat|fix|chore)/[a-z0-9-]+-[0-9]+$`
  - PR title prefix: `feat:`, `fix:`, or `chore:`
  - PR body sections: `## Summary`, `## Implementation Notes`, `## Testing Notes`
  - Required issue link pattern: `Closes #<issueNumber>`

Recommended project-board automations (configure in GitHub Project workflows or Actions):

- Auto-add new issues to project -> `Backlog`
- Move linked issue to `In Review` when PR opens
- Move issue to `Done` when issue closes from merged PR
- Auto-label issue type/state from templates (`type:*`, `status:*`)

## Maintenance Responsibility

When `.agents` structure, issue/PR conventions, or board workflow changes, update:

- `agents.md`
- `copilot-instructions.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
