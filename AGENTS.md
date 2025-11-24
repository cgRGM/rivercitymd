# Agent Guidelines for River City Mobile Detailing

River City Mobile Detailing is a Next.js web app for managing a mobile car detailing business with customer dashboards, admin portals, and Stripe payments.

## Build/Lint/Test Commands

- **Build**: `npm run build` (Next.js production build)
- **Dev**: `npm run dev` (runs frontend and backend in parallel)
- **Lint**: `npm run lint` (Next.js ESLint)
- **Test**: `npm run test` (vitest), `npm run test:once` (single run), `npm run test:coverage` (with coverage)
- **Single Test**: `npx vitest run <test-file>` (run specific test file)

## Code Style Guidelines

- Absolute imports with `@/` prefix, React: `import * as React from "react"`
- Convex: `import { query, mutation } from "./_generated/server"`, UI: `@/components/ui/*`
- Prettier (2-space indent), ESLint with Next.js core web vitals and TypeScript
- Strict TypeScript, proper type annotations, `Id<"tableName">` for Convex IDs, union types for enums
- Files: kebab-case, Components: PascalCase, Variables/Functions: camelCase, Types: PascalCase, Constants: UPPER_SNAKE_CASE
- Throw descriptive `Error` objects, early returns for validation
- Functional components with hooks, `"use client"` directive, `useQuery` for Convex data, controlled components with React Hook Form
- `cn()` utility for className merging, shadcn/ui "new-york" style, Tailwind with CSS variables, Lucide icons, responsive mobile-first design

## Cursor Rules

Follow `.cursor/rules/convex_rules.mdc` for Convex development (new function syntax, validators, schema design, auth patterns)
