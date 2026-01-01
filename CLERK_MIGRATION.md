# Clerk Migration Guide

## Status: In Progress

This document tracks the migration from `@convex-dev/auth` to Clerk.

## Completed Steps

1. ✅ Installed `@clerk/nextjs` package
2. ✅ Updated `convex/auth.config.ts` to use Clerk JWT issuer domain
3. ✅ Updated `convex/auth.ts` to use `ctx.auth.getUserIdentity()` 
4. ✅ Updated `convex/schema.ts` to remove `authTables` and add `clerkUserId` field
5. ✅ Updated `components/ConvexClientProvider.tsx` to use `ConvexProviderWithClerk`
6. ✅ Updated `app/layout.tsx` to wrap with `ClerkProvider`
7. ✅ Updated `middleware.ts` (renamed from `proxy.ts`) to use Clerk middleware
8. ✅ Updated `convex/http.ts` to remove auth routes
9. ⏳ In Progress: Updating all Convex functions to use `getUserIdFromIdentity()`

## Remaining Steps

### Update All Convex Functions

Replace all instances of:
- `import { getAuthUserId } from "@convex-dev/auth/server";` 
- `await getAuthUserId(ctx)`

With:
- `import { getUserIdFromIdentity } from "./auth";`
- `await getUserIdFromIdentity(ctx)`

Files to update:
- [x] `convex/users.ts` (partially done)
- [ ] `convex/services.ts`
- [ ] `convex/payments.ts`
- [ ] `convex/reviews.ts`
- [ ] `convex/invoices.ts`
- [ ] `convex/appointments.ts`
- [ ] `convex/analytics.ts`
- [ ] `convex/depositSettings.ts`
- [ ] `convex/business.ts`
- [ ] `convex/availability.ts`
- [ ] `convex/vehicles.ts`
- [ ] `convex/chat.ts`

### Update Client Components

Replace all instances of:
- `import { useAuthActions } from "@convex-dev/auth/react";`
- `const authActions = useAuthActions();`
- `authActions.signIn()`, `authActions.signOut()`, etc.

With:
- `import { useAuth, useUser, SignInButton, SignOutButton } from "@clerk/nextjs";`
- `const { userId, isSignedIn } = useAuth();`
- Use Clerk's `<SignInButton />` and `<SignOutButton />` components

Files to update:
- [ ] `app/sign-in/page.tsx`
- [ ] `app/sign-up/page.tsx`
- [ ] `components/sign-out-button.tsx`
- [ ] `components/dashboard/dashboard-sidebar.tsx`
- [ ] `components/admin/admin-sidebar.tsx`
- [ ] `components/home/appointment-modal.tsx`

### Environment Variables

Add to Convex Dashboard and Vercel:
- `CLERK_JWT_ISSUER_DOMAIN` - From Clerk Dashboard → JWT Templates → "convex" template
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk Dashboard → API Keys
- `CLERK_SECRET_KEY` - From Clerk Dashboard → API Keys

### User Migration

Existing users will need to:
1. Sign up again with Clerk (or we can create a migration script)
2. Link their existing Convex user record to their Clerk user ID

## Testing Checklist

- [ ] Sign up flow works
- [ ] Sign in flow works
- [ ] Sign out works
- [ ] Protected routes redirect correctly
- [ ] User role checking works
- [ ] Onboarding flow works
- [ ] All Convex queries/mutations work with new auth
- [ ] Admin routes are protected
- [ ] Client routes are protected

