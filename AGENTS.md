# Agent Guidelines for River City Mobile Detailing

## Build/Lint/Test Commands

- **Build**: `npm run build` (Next.js production build)
- **Dev**: `npm run dev` (runs frontend and backend in parallel)
- **Lint**: `npm run lint` (Next.js ESLint)
- **Test**: No test framework configured yet

## Code Style Guidelines

### Imports

- Use absolute imports with `@/` prefix (configured in tsconfig.json)
- React imports: `import * as React from "react"`
- Convex imports: `import { query, mutation } from "./_generated/server"`
- UI components: Import from `@/components/ui/*`

### Formatting

- Uses Prettier with default configuration
- ESLint with Next.js core web vitals and TypeScript rules
- 2-space indentation (Prettier default)

### Types & TypeScript

- Strict TypeScript enabled
- Use proper type annotations for all function parameters
- Define interfaces for complex object types
- Use `Id<"tableName">` for Convex document IDs
- Use union types for status enums: `"pending" | "confirmed" | ...`

### Naming Conventions

- **Files**: kebab-case (e.g., `dashboard-client.tsx`, `user-profile.ts`)
- **Components**: PascalCase (e.g., `DashboardClient`, `Button`)
- **Variables/Functions**: camelCase (e.g., `userId`, `getCurrentUser`)
- **Types/Interfaces**: PascalCase (e.g., `UserProfile`, `AppointmentData`)
- **Constants**: UPPER_SNAKE_CASE (rarely used)

### Error Handling

- Throw `Error` objects with descriptive messages
- Use early returns for validation failures
- Check authentication before database operations

### React Patterns

- Use functional components with hooks
- Add `"use client"` directive for client components
- Use `useQuery` for Convex data fetching
- Prefer controlled components with React Hook Form
- Use `cn()` utility for conditional className merging

### Convex Backend

- Use new function syntax with `args` and `returns` validators
- Always include argument and return type validators
- Use `getAuthUserId(ctx)` for authentication
- Follow file-based routing in `convex/` directory
- Use proper indexes for queries (defined in schema.ts)

### UI/UX

- Uses shadcn/ui components with "new-york" style
- Tailwind CSS with CSS variables for theming
- Lucide React icons
- Responsive design with mobile-first approach

## Cursor Rules

Follow all guidelines in `.cursor/rules/convex_rules.mdc` for Convex development, including:

- New function syntax for all Convex functions
- Proper validator usage
- Schema design best practices
- Authentication and authorization patterns
