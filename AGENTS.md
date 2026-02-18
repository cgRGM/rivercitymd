# River City Mobile Detailing - Agent Guidelines

This document serves as the primary reference for AI agents and developers working on the River City Mobile Detailing repository.

## 🚀 Project Overview

- **Framework**: Next.js 16 (App Router)
- **Backend/Database**: Convex (Real-time database + backend functions)
- **Authentication**: **Clerk** (Migrated from Convex Auth).
  - *Note*: `@convex-dev/auth` packages may exist but Clerk is the active auth provider.
- **Styling**: Tailwind CSS + Shadcn UI
- **Payments**: Stripe
- **Testing**: Vitest

## ⚠️ Critical Rules

1.  **Deployment**: NEVER run `npx convex deploy` or git commands unless explicitly instructed by the user.
2.  **Authentication Source of Truth**:
    -   **Frontend**: Use Clerk hooks (`useUser`, `useAuth`, `useSignIn`, `useSignUp`).
    -   **Backend**: Use `ctx.auth.getUserIdentity()` to get the authenticated user.
    -   **User Data**: User profile data (address, vehicles) is stored in Convex `users` table, linked by `clerkUserId`.
3.  **Schema First**: Always define data models in `convex/schema.ts` before writing business logic.

## 🛠 Convex Best Practices

### Function Organization
-   Group functions by domain (e.g., `convex/users.ts`, `convex/services.ts`, `convex/appointments.ts`).
-   Use `internalMutation` / `internalQuery` for logic that should not be exposed to the client.

### Data Access & logic
-   **Indexes over Filters**: Always use `withIndex` for querying. Avoid `filter` unless the dataset is guaranteed to be small.
    ```typescript
    // GOOD
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    
    // BAD (for large tables)
    .filter((q) => q.eq(q.field("userId"), args.userId))
    ```
-   **Idempotency**: Ensure mutations can be retried safely. Check state before applying changes.
-   **Validation**: Always use `zod` or Convex `v` validators for arguments AND return values.
-   **Error Handling**: Throw `ConvexError` for errors that should be displayed to the user.

### TypeScript
-   Use `Id<"tableName">` for document IDs.
-   Use `Doc<"tableName">` for full document types.
-   Avoid `any`.

## 🎨 Frontend Design Guidelines

### Aesthetic Direction
-   **Goal**: Create **distinctive, production-grade** interfaces. Avoid generic "AI slop" or default bootstrap-like looks.
-   **Style**: Bold, high-quality, "premium". Use deep blacks/grays for dark mode, vibrant accents.
-   **Typography**: Use specific, characterful fonts (Inter is okay if styled well, but prefer more distinct options if available).
-   **Motion**: Use `framer-motion` (or `motion`) for smooth, staggering entrances and micro-interactions.

### Component Architecture
-   Use **Shadcn UI** components from `@/components/ui`.
-   **Client Components**: Marking `"use client"` is necessary for interactive components.
-   **Server Components**: Default to server components where possible for data fetching (though Convex relies heavily on client-side subscriptions).

## 🛡 Workflow & Feature Scope

### Avoiding Feature Creep
-   **Validation**: Before adding a feature, ask: "Does this solve a user problem?"
-   **MVP Mindset**: Build the smallest version that works.
-   **"No" is okay**: If a request seems out of scope, politely challenge it or suggest a simpler alternative.

### Testing
-   Run tests with `pnpm test` (Vitest).
-   Write tests for critical logic, especially payment flows and complex schedulers.

## 📂 Common Commands

-   **Start Dev Server**: `pnpm dev` (Runs Next.js and Convex concurrently)
-   **Build**: `pnpm build`
-   **Lint**: `pnpm lint`
-   **Test**: `pnpm test`
-   **Type Check**: `pnpm tsc --noEmit`

## 🔗 Key Documentation Files
-   `CLERK_MIGRATION_COMPLETE.md`: Details on the current auth setup.
-   `convex/schema.ts`: Database schema definition.
-   `.agents/skills/`: Directory containing specific agent skills (read `SKILL.md` in subdirs for deep dives).
