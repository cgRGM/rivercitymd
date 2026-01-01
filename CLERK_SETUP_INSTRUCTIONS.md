# Clerk Setup Instructions

## Prerequisites

1. Sign up for a free Clerk account at https://clerk.com/sign-up
2. Create a new application in Clerk Dashboard

## Step 1: Create JWT Template in Clerk

1. In Clerk Dashboard, navigate to **JWT Templates**
2. Click **New template**
3. Select **Convex** from the list of templates
4. **Important**: Do NOT rename the JWT token. It must be called `convex`
5. Copy the **Issuer URL** (this is your `CLERK_JWT_ISSUER_DOMAIN`)
   - Development format: `https://verb-noun-00.clerk.accounts.dev`
   - Production format: `https://clerk.<your-domain>.com`

## Step 2: Get API Keys

1. In Clerk Dashboard, navigate to **API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

## Step 3: Configure Environment Variables

### In Convex Dashboard

1. Go to your Convex project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add:
   - `CLERK_JWT_ISSUER_DOMAIN` = Your Issuer URL from Step 1

### In Vercel (Production)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add for **Production** environment:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = Your Publishable Key
   - `CLERK_SECRET_KEY` = Your Secret Key
   - `CLERK_JWT_ISSUER_DOMAIN` = Your Issuer URL (same as Convex)

### In Local Development (.env.local)

Add to your `.env.local` file:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-instance.clerk.accounts.dev
```

## Step 4: Configure Sign-In Methods

1. In Clerk Dashboard, go to **User & Authentication** → **Email, Phone, Username**
2. Enable the sign-in methods you want:
   - Email (recommended)
   - Password (required for email/password auth)
   - Optional: Google, GitHub, etc.

## Step 5: Deploy and Test

1. Deploy your Convex functions: `npx convex deploy`
2. Deploy your Next.js app to Vercel
3. Test the sign-up and sign-in flows

## Migration Notes

### Existing Users

Existing users from `@convex-dev/auth` will need to:
1. Sign up again with Clerk using the same email
2. The system will automatically link their account if the email matches

### User Creation Flow

When a user signs in with Clerk for the first time:
1. Clerk authenticates the user
2. The app calls `ensureUserFromClerk` mutation (if needed)
3. A Convex user record is created/linked with the Clerk user ID
4. Stripe customer is created automatically

## Troubleshooting

### "CLERK_JWT_ISSUER_DOMAIN is not set"
- Make sure you've set this in your Convex Dashboard environment variables
- The value should be your Clerk Issuer URL (not your site URL)

### "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
- Make sure you've set this in Vercel environment variables
- Check that it's set for the correct environment (Production/Preview/Development)

### Users can't sign in
- Check that the JWT template is named exactly `convex` (case-sensitive)
- Verify the Issuer URL matches in both Convex and Vercel
- Check Clerk Dashboard logs for authentication errors

### Users not appearing in Convex
- The `ensureUserFromClerk` mutation should be called automatically
- Check Convex logs for errors during user creation
- Verify the email in Clerk matches the email in your Convex users table

