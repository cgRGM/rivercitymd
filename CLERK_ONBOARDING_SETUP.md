# Clerk Onboarding Integration Setup

This document explains how to complete the Clerk onboarding integration setup.

## 1. Add Custom Claim to Session Token

You need to add a custom claim to your Clerk session token to access the user's `publicMetadata` in your middleware.

### Steps:

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Sessions** page
3. Under **Customize session token**, find the **Claims editor**
4. Add the following JSON to include the user's public metadata:

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

5. Click **Save**

This will make the `onboardingComplete` flag from `publicMetadata` available in your middleware via `sessionClaims?.metadata?.onboardingComplete`.

## 2. Environment Variables

Add the following environment variables to your `.env.local` and Vercel:

```env
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/onboarding
```

### Vercel Setup:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add both variables for **Production**, **Preview**, and **Development** environments

## 3. How It Works

### Flow:

1. **User signs up** → Redirected to `/onboarding` (via `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL`)
2. **User completes onboarding form** → Data saved to Convex + Clerk `publicMetadata.onboardingComplete = true`
3. **User reloads** → Clerk session token includes `metadata.onboardingComplete = true`
4. **Middleware checks** → If `onboardingComplete` is true, user can access protected routes
5. **User signs in later** → Redirected to `/dashboard` (via `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`)

### Files Modified:

- `types/globals.d.ts` - TypeScript definitions for custom session claims
- `proxy.ts` - Middleware now checks `sessionClaims?.metadata?.onboardingComplete`
- `app/onboarding/layout.tsx` - Redirects if onboarding already complete
- `app/onboarding/_actions.ts` - Server action to update Clerk's `publicMetadata`
- `app/onboarding/page.tsx` - Updated to use Clerk's `useUser` and call server action

### Key Changes:

- **Before**: Onboarding status checked via Convex query in middleware
- **After**: Onboarding status checked via Clerk's session token claims (faster, no extra API call)

## 4. Testing

1. Sign up a new user
2. Complete the onboarding form
3. Verify you're redirected to `/dashboard`
4. Sign out and sign back in
5. Verify you're redirected to `/dashboard` (not `/onboarding`)

## 5. Troubleshooting

### Issue: Users still redirected to onboarding after completing it

**Solution**: 
- Verify the custom claim is added in Clerk Dashboard
- Check that `completeOnboarding` server action is being called
- Verify `user.reload()` is called after updating metadata
- Check browser console for errors

### Issue: TypeScript errors about `sessionClaims.metadata`

**Solution**: 
- Ensure `types/globals.d.ts` is in your project root
- Restart your TypeScript server
- Verify the file exports an empty object and declares the global interface

### Issue: Middleware not redirecting properly

**Solution**:
- Check that `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL` is set
- Verify the middleware matcher includes your routes
- Check server logs for errors

