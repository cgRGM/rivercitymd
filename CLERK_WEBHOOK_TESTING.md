# Clerk Webhook Testing with Svix Play

This guide explains how to test Clerk webhooks using Svix Play for development.

## Understanding Svix Play

Svix Play is a webhook testing tool that:
- Provides a unique HTTPS URL to receive webhooks
- Allows you to inspect webhook payloads in your browser
- Can forward webhooks to your actual endpoint (with configuration)

Your Svix Play endpoint: `https://play.svix.com/in/e_VnpSBA9SuEoPW6IWK3PWUC2iAAD/`

## Option 1: Use Svix Play for Inspection Only (Recommended for Testing)

This approach lets you inspect webhooks in Svix Play, then manually test your endpoint.

### Setup Steps:

1. **Configure Clerk to send to Svix Play:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks
   - Update your webhook endpoint to: `https://play.svix.com/in/e_VnpSBA9SuEoPW6IWK3PWUC2iAAD/`
   - Select events: `user.created`, `user.updated`, `user.deleted`
   - Save the webhook

2. **View webhooks in Svix Play:**
   - Navigate to: `https://play.svix.com/view/e_VnpSBA9SuEoPW6IWK3PWUC2iAAD`
   - You'll see all webhook events sent by Clerk
   - Inspect headers, body, and signatures

3. **Test your Convex endpoint manually:**
   - Copy the webhook payload from Svix Play
   - Use a tool like Postman or curl to send it to: `https://patient-wombat-877.convex.site/clerk-users-webhook`
   - Or use Clerk's "Send test event" feature pointing directly to your Convex endpoint

## Option 2: Use Svix CLI for Local Development (Best for Active Development)

For active development, use Svix CLI to tunnel webhooks to your local server.

### Setup Steps:

1. **Install Svix CLI:**
   ```bash
   npm install -g svix-cli
   # or
   pnpm add -g svix-cli
   ```

2. **Start local tunnel:**
   ```bash
   svix listen http://localhost:3000/clerk-users-webhook
   ```
   This creates a public URL that forwards to your local server.

3. **Configure Clerk:**
   - Use the URL provided by Svix CLI in Clerk Dashboard → Webhooks
   - The webhook will be forwarded to your local development server

4. **For Convex (cloud endpoint):**
   Since Convex runs in the cloud, you can't use localhost. Instead:
   - Configure Clerk to send directly to: `https://patient-wombat-877.convex.site/clerk-users-webhook`
   - Use Svix Play only for inspection/testing

## Option 3: Direct to Convex (Production-like Testing)

For the most accurate testing, configure Clerk to send directly to your Convex endpoint.

### Setup Steps:

1. **Configure Clerk Webhook:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks
   - Endpoint URL: `https://patient-wombat-877.convex.site/clerk-users-webhook`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the Signing Secret (starts with `whsec_`)

2. **Set Environment Variable in Convex:**
   - Go to [Convex Dashboard](https://dashboard.convex.dev) → Settings → Environment Variables
   - Add: `CLERK_WEBHOOK_SECRET` = your signing secret from Clerk

3. **Test:**
   - Create a new user in your app
   - Check Convex Dashboard → Data → users table
   - User should be created automatically

4. **Use Svix Play for Inspection:**
   - You can still use Svix Play to inspect webhook payloads
   - Configure Clerk to send to both endpoints (if supported) or switch between them

## Current Configuration

Your current setup:
- **Convex Endpoint**: `https://patient-wombat-877.convex.site/clerk-users-webhook`
- **Webhook Secret**: Set in `.env.local` as `CLERK_WEBHOOK_SECRET`
- **Events Handled**: `user.created`, `user.updated`, `user.deleted`

## Testing Checklist

- [ ] Webhook endpoint is accessible (check Convex logs)
- [ ] Webhook secret is set in Convex environment variables
- [ ] Clerk is configured to send to the correct endpoint
- [ ] Test user creation - verify user appears in Convex
- [ ] Test user update - verify data syncs
- [ ] Test user deletion - verify user is removed

## Troubleshooting

### Webhook Not Received

1. **Check Convex Logs:**
   - Go to Convex Dashboard → Logs
   - Look for requests to `/clerk-users-webhook`

2. **Verify Endpoint URL:**
   - Must use `.convex.site` (not `.convex.cloud`)
   - Format: `https://<deployment>.convex.site/clerk-users-webhook`

3. **Check Webhook Secret:**
   - Must be set in Convex Dashboard (not just `.env.local`)
   - Secret should start with `whsec_`

### Signature Verification Fails

- Ensure `CLERK_WEBHOOK_SECRET` is set in Convex Dashboard
- Verify the secret matches what Clerk shows in the webhook settings
- Check that Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`) are present

### Users Not Created

1. Check Convex logs for errors
2. Verify the webhook handler is processing events
3. Test with Clerk's "Send test event" feature

## Recommended Approach for Development

**For active development:**
- Use Option 3 (Direct to Convex) for real testing
- Use Svix Play for inspecting payloads when debugging

**For initial setup/testing:**
- Use Option 1 (Svix Play) to see what Clerk sends
- Then switch to Option 3 for actual integration

## Next Steps

1. Fix the TypeScript error (Stripe API version) - ✅ Done
2. Configure Clerk webhook endpoint (choose one of the options above)
3. Test webhook delivery
4. Verify user sync works correctly
