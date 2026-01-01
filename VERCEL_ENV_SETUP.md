# Vercel Environment Variables Setup

## Problem

When deploying to Vercel, Convex CLI detects a non-production environment even though you have production keys set. This causes the error:

```
✖ Detected a non-production build environment and "CONVEX_DEPLOY_KEY" for a production Convex deployment.
```

## Solution

Set the following environment variables in Vercel's dashboard for **Production** environment:

### Required Environment Variables

1. **`CONVEX_DEPLOYMENT=production`** ⚠️ **CRITICAL - This is likely missing!**
   - This tells Convex CLI that this is a production deployment
   - Without this, Convex will detect it as a dev environment

2. **`CONVEX_DEPLOY_KEY`**
   - Your production Convex deploy key
   - Already set in Vercel (based on error message)

3. **`NEXT_PUBLIC_CONVEX_URL`**
   - Your production Convex URL (e.g., `https://your-project.convex.cloud`)

4. **`CONVEX_SITE_URL`**
   - Your production site URL (e.g., `https://your-app.vercel.app`)

5. **`STRIPE_SECRET_KEY`**
   - Your production Stripe secret key (starts with `sk_live_`)

6. **`STRIPE_WEBHOOK_SECRET`**
   - Your production Stripe webhook secret (starts with `whsec_`)

7. **`RESEND_API_KEY`** (required for email)
   - Your Resend API key for production
   - Get this from https://resend.com/api-keys

8. **`RESEND_WEBHOOK_SECRET`** (required for email)
   - Your Resend webhook secret for production
   - Get this from Resend dashboard → Webhooks → Your webhook → Signing secret

## Email Setup (Resend)

To enable email functionality in production:

1. **Add Domain in Resend:**
   - Go to https://resend.com/domains
   - Add domain: `rivercitymd.com`
   - Verify DNS records (SPF, DKIM, DMARC) in your domain registrar
   - Wait for domain verification (usually takes a few minutes)

2. **Configure Webhook in Resend:**
   - Go to https://resend.com/webhooks
   - Create new webhook with URL: `https://your-convex-url.convex.site/resend-webhook`
   - Select events: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`
   - Copy the webhook signing secret to use as `RESEND_WEBHOOK_SECRET`

3. **Email Configuration:**
   - All emails are sent from: `notifications@rivercitymd.com`
   - Make sure the domain `rivercitymd.com` is verified in Resend before deploying

## How to Set in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable above
4. **Important**: Make sure to select **Production** environment (not Preview or Development)
5. Save and redeploy

## Verification

After setting `CONVEX_DEPLOYMENT=production`, the build should succeed. The error message will disappear because Convex CLI will correctly identify it as a production deployment.

## Notes

- `.env.local` is gitignored and won't be deployed, so it won't interfere
- Vercel environment variables take precedence over any `.env` files
- Make sure all variables are set for the **Production** environment specifically
