# Clerk Webhook Setup Instructions

This guide explains how to set up Clerk webhooks to automatically sync user data with your Convex database. This ensures users are created immediately when they sign up with Clerk, and their data stays in sync.

## Why Webhooks?

Without webhooks:
- Users are only created in Convex when they complete onboarding
- If a user's Convex record is missing, they must onboard again
- User data can become out of sync between Clerk and Convex

With webhooks:
- Users are created in Convex immediately when they sign up with Clerk
- User data (name, email, image) stays automatically synced
- Onboarding status is preserved (stored in Convex, not lost)

## Step 1: Get Your Convex Deployment URL

1. Go to your [Convex Dashboard](https://dashboard.convex.dev)
2. Navigate to **Settings** → **Deployments**
3. Copy your **Deployment URL** (e.g., `https://happy-horse-123.convex.site`)
   - **Important**: The URL ends in `.site`, not `.cloud`

## Step 2: Configure Webhook in Clerk Dashboard

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Webhooks** in the left sidebar
3. Click **+ Add Endpoint**
4. Configure the endpoint:
   - **Endpoint URL**: `https://<your-deployment-name>.convex.site/clerk-users-webhook`
     - Example: `https://happy-horse-123.convex.site/clerk-users-webhook`
   - **Message Filtering**: Select **user** events:
     - ✅ `user.created`
     - ✅ `user.updated`
     - ✅ `user.deleted`
5. Click **Create**

## Step 3: Get the Webhook Signing Secret

1. After creating the webhook endpoint, you'll see a **Signing Secret** on the right side
2. Copy the secret (it starts with `whsec_`)
3. **Important**: Keep this secret secure - you'll need it for the next step

## Step 4: Set Environment Variable in Convex

1. Go to your [Convex Dashboard](https://dashboard.convex.dev)
2. Navigate to **Settings** → **Environment Variables**
3. Click **Add Variable**
4. Add:
   - **Name**: `CLERK_WEBHOOK_SECRET`
   - **Value**: The signing secret from Step 3 (starts with `whsec_`)
5. Click **Save**

## Step 5: Deploy Your Convex Functions

Deploy your updated Convex functions to make the webhook endpoint available:

```bash
npx convex deploy
```

## Step 6: Test the Webhook

1. In Clerk Dashboard, go to your webhook endpoint
2. Click **Send test event** or **Test endpoint**
3. Check your Convex Dashboard → **Data** → **users** table
4. You should see a new user record created

Alternatively, create a new user account in your app and verify they appear in Convex immediately.

## How It Works

### User Created (`user.created`)
When a user signs up with Clerk:
1. Clerk sends a webhook to your Convex endpoint
2. `upsertFromClerk` mutation creates a new user record in Convex
3. User is created with default role "client" (admin role must be set manually in Convex dashboard)
4. User can now sign in and will be redirected to onboarding if needed

### User Updated (`user.updated`)
When a user updates their profile in Clerk:
1. Clerk sends a webhook with updated data
2. `upsertFromClerk` mutation updates the user record
3. **Important**: Onboarding data (address, phone, vehicles) is preserved
4. **Important**: Role is NEVER updated by webhook (completely preserved)
5. Only basic fields (name, email, image, clerkUserId) are updated

### User Deleted (`user.deleted`)
When a user deletes their account in Clerk:
1. Clerk sends a webhook
2. `deleteFromClerk` mutation:
   - Deletes all vehicles associated with the user
   - Deletes the user record from Convex

## Role Management

**Important**: The webhook does NOT manage user roles. Roles are manually set in the Convex dashboard.

- **New users**: Created with default role "client"
- **Existing users**: Role is NEVER updated by webhook (completely preserved)
- **Admin users**: Admin role must be set manually in Convex dashboard and will never be overwritten

The webhook only syncs:
- `name` (from Clerk)
- `email` (from Clerk)  
- `image` (from Clerk)
- `clerkUserId` (from Clerk)

All other fields (role, address, phone, vehicles, stripeCustomerId, status, etc.) are preserved and never touched by the webhook.

## Onboarding Status Preservation

The webhook implementation is designed to preserve onboarding data:

- **New users**: Created with basic info, role defaults to "client"
- **Existing users**: Only name, email, image, and clerkUserId are updated
- **Onboarding data preserved**: Address, phone, vehicles, role, and all other fields are never overwritten

## Troubleshooting

### Webhook Not Receiving Events

1. **Check endpoint URL**: Make sure it ends in `.site` (not `.cloud`)
2. **Verify webhook is enabled**: Check Clerk Dashboard → Webhooks → Your endpoint
3. **Check Convex logs**: Go to Convex Dashboard → Logs to see if requests are arriving
4. **Test endpoint**: Use Clerk's "Send test event" feature

### "CLERK_WEBHOOK_SECRET is not set" Error

1. Make sure you've set `CLERK_WEBHOOK_SECRET` in Convex Dashboard
2. Verify the secret starts with `whsec_`
3. Redeploy your Convex functions after setting the variable

### Users Not Being Created

1. Check Convex logs for errors
2. Verify the webhook signature is valid (check logs for verification errors)
3. Ensure the webhook endpoint is receiving events (check Clerk Dashboard → Webhooks → Recent events)

### Onboarding Data Lost

This should not happen with the current implementation. The webhook only updates:
- `name` (from Clerk)
- `email` (from Clerk)
- `image` (from Clerk)
- `clerkUserId` (from Clerk)

All other fields (address, phone, vehicles, role, stripeCustomerId, status, etc.) are preserved and never touched by the webhook.

### Role Overwritten

This should never happen. The webhook explicitly does NOT update the role field for existing users. If you set a user to "admin" in Convex, the webhook will never change it, even if the user updates their profile in Clerk.

## Environment Variables Summary

### Required in Convex Dashboard:
- `CLERK_WEBHOOK_SECRET` - Webhook signing secret from Clerk (starts with `whsec_`)

### Already Configured:
- `CLERK_JWT_ISSUER_DOMAIN` - For authentication (from previous setup)
- `STRIPE_SECRET_KEY` - For payment processing

## Next Steps

After setting up webhooks:
1. Test by creating a new user account
2. Verify the user appears in Convex immediately
3. Complete onboarding and verify data is preserved
4. Update user profile in Clerk and verify Convex is updated
5. Monitor webhook events in Clerk Dashboard for any issues

## Related Documentation

- [Clerk Webhooks Documentation](https://clerk.com/docs/integrations/webhooks/overview)
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions)
- [Clerk Setup Instructions](./CLERK_SETUP_INSTRUCTIONS.md)
- [Clerk Organization Setup](./CLERK_ORGANIZATION_SETUP.md)

