---
applyTo: "**/*.{ts,tsx,js,jsx}"
---

# GitHub‑Driven Development Workflow

This file defines how autonomous agents should plan, implement, test, and ship code using **GitHub Issues, GitHub Projects, and Pull Requests as the source of truth**.

The goal is to enforce a reliable **Plan → Branch → Implement → Test → PR → Merge → Ship** workflow while integrating tightly with the GitHub CLI (`gh`).

Reference:
https://cli.github.com/manual/gh

---

# Core Principles

1. **GitHub is the source of truth**
   - Issues define work
   - Projects track progress
   - PRs ship code

2. **Never push directly to `main` or `master`**

3. **Every change must trace to a GitHub Issue**

4. **All work flows through a Pull Request**

5. **Project status must reflect real development state**

---

# Development Lifecycle

Agents must follow this lifecycle.

1. Discover or create Issue
2. Ensure repository Project exists
3. Add Issue to Project (Backlog)
4. Enter Plan Mode
5. Create branch
6. Implement
7. Run quality gates
8. Preview if applicable
9. Open Pull Request
10. Update Project status
11. Address CI/review
12. Merge
13. Mark Project item Done

---

# Plan Mode (Required Before Coding)

Before generating code, the agent must:

1. Read the GitHub Issue
2. Extract acceptance criteria
3. Identify affected files
4. Identify required tests
5. Define implementation strategy
6. Confirm branch strategy

Plan output should include:

- Issue link
- Implementation steps
- File changes
- Test strategy
- Branch name
- PR plan

Agents must **not begin coding until Plan Mode completes**.

---

# GitHub CLI Operational Commands

Agents should use `gh` for GitHub interactions.

## Verify authentication

```bash
gh auth status
```

## Confirm repository context

```bash
gh repo view
```

---

# Issue Workflow

## List Issues

```bash
gh issue list --state open
```

## Search Issues

```bash
gh issue list --search "<keywords>"
```

## View Issue

```bash
gh issue view <issueNumber> --comments
```

## Create Issue

```bash
gh issue create --title "feat: ..." --body "..."
```

Issue titles must follow:

- `feat:`
- `fix:`
- `chore:`

Example:

```
feat: add authentication middleware
```

---

# GitHub Project Workflow

Every repository should have a **GitHub Project (kanban)** attached.

Agents must ensure a project exists before beginning work.

## Determine repo owner

```bash
gh repo view --json owner,name -q '.owner.login'
```

## List Projects

```bash
gh project list --owner <orgOrUser>
```

## View Project

```bash
gh project view <projectNumber> --owner <orgOrUser>
```

## Create Project if none exists

```bash
gh project create \
  --owner <orgOrUser> \
  --title "<repo-name> Project"
```

---

# Project Status Mapping

| Development State | Project Status |
| ----------------- | -------------- |
| Issue created     | Backlog        |
| Branch created    | In Progress    |
| PR opened         | In Review      |
| PR merged         | Done           |

---

# Add Issue to Project

```bash
gh project item-add <projectNumber> \
  --owner <orgOrUser> \
  --url <issueUrl>
```

---

# View Project Items

```bash
gh project item-list <projectNumber> \
  --owner <orgOrUser>
```

---

# Update Project Status

Retrieve field IDs:

```bash
gh project view <projectNumber> \
  --owner <orgOrUser> \
  --format json
```

Update status:

```bash
gh project item-edit <projectNumber> \
  --owner <orgOrUser> \
  --id <itemId> \
  --field-id <statusFieldId> \
  --single-select-option-id <optionId>
```

If status update cannot be performed due to missing IDs, log the reason and continue development.

---

# Branch Strategy

Branches must always derive from `main`.

Update main first:

```bash
git checkout main
git pull origin main
```

Create branch:

```bash
git checkout -b <type>/<slug>-<issueNumber>
```

Branch naming rules:

```
feat/<slug>-<issueNumber>
fix/<slug>-<issueNumber>
chore/<slug>-<issueNumber>
```

Example:

```
feat/auth-middleware-42
```

Rules:

- lowercase
- kebab-case
- descriptive slug

---

# Pull Request Rules

PR title must match the Issue title exactly.

Required PR body:

```
## Summary

## Implementation Notes

## Testing Notes

Closes #<issueNumber>
```

Create PR:

```bash
gh pr create \
  --title "<issueTitle>" \
  --body "<PR body>" \
  --base main \
  --head <branchName>
```

---

# Merge Rules

Only merge when:

- CI passes
- Tests pass
- Review feedback resolved

Merge PR:

```bash
gh pr merge --merge --delete-branch
```

After merge:

- Issue closes automatically
- Move Project item → Done

---

# Required Quality Gates

Agents must run before PR:

```bash
pnpm check
pnpm typecheck
pnpm test
```

If lint fixes required:

```bash
pnpm fix
```

Follow **Ultracite standards**.

---

# Repository Architecture Conventions

Follow existing project structure.

```
app/
components/
lib/
db/
workflows/
```

Avoid unrelated refactors.

Changes must stay focused on the Issue.

---

# Agent Skill Routing

Agents should inspect `.agents/skills` before implementing work.

| Domain                      | Path                                         | Purpose                          |
| --------------------------- | -------------------------------------------- | -------------------------------- |
| Copywriting                 | `.agents/skills/copywriting`                 | Marketing copy frameworks        |
| Programmatic SEO            | `.agents/skills/programmatic-seo`            | SEO page generation              |
| SEO Audit                   | `.agents/skills/seo-audit`                   | Technical SEO diagnostics        |
| Email Best Practices        | `.agents/skills/email-best-practices`        | Deliverability & compliance      |
| Frontend Design             | `.agents/skills/frontend-design`             | UI design guidance               |
| Vercel Composition Patterns | `.agents/skills/vercel-composition-patterns` | React composition                |
| Vercel React Best Practices | `.agents/skills/vercel-react-best-practices` | Next.js performance              |
| Workflow                    | `.agents/skills/workflow`                    | Reserved for workflow automation |

Agents must inspect the relevant skill's `SKILL.md` before implementing code.

---

# Synchronization Rule

Keep this file synchronized with:

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.agents/workflow/*`

When updating workflow rules, update all references in the same PR.

---

# Summary

Agents must operate using:

Issue → Plan → Branch → Implement → Test → PR → Merge → Done

GitHub Issues and Projects must always reflect the **true state of development**.
