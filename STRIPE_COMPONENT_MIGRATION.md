# Stripe Component Migration (Hybrid Approach)

This document describes the migration to use `@convex-dev/stripe` component alongside our custom business logic.

## Changes Made

### 1. Package Installation
- Added `@convex-dev/stripe` to dependencies (via pnpm)

### 2. Component Configuration
- **`convex/convex.config.ts`**: Added stripe component to the app
- **`convex/stripeClient.ts`**: Created shared Stripe client instance

### 3. Webhook Integration
- **`convex/http.ts`**: 
  - Registered component webhook routes using `registerRoutes`
  - Component handles webhook signature verification and data sync automatically
  - Added custom event handlers for our business logic:
    - `checkout.session.completed` - Deposit payment handling
    - `payment_intent.succeeded` - Backup deposit handler
    - `invoice.paid` - Invoice payment completion
    - `invoice.payment_failed` - Payment failure handling
    - `invoice.voided` - Invoice void handling

### 4. Customer Management
- **`convex/users.ts`**:
  - Updated `ensureStripeCustomer` to use `stripeClient.getOrCreateCustomer()`
  - Removed manual Stripe customer creation code
  - Component automatically syncs customer data to its tables

### 5. Checkout Sessions
- **`convex/payments.ts`**:
  - Updated `createDepositCheckoutSession` to use `stripeClient.createCheckoutSession()` when priceId is available
  - Falls back to manual API calls for dynamic amounts (price_data)
  - Component handles checkout session creation with proper error handling

## What the Component Provides

1. **Automatic Data Sync**: Component tables (`customers`, `payments`, `invoices`, `checkout_sessions`) are automatically synced from webhooks
2. **Webhook Signature Verification**: Handled automatically by the component
3. **Customer Management**: `getOrCreateCustomer()` simplifies customer creation
4. **Checkout Sessions**: `createCheckoutSession()` for fixed-price checkouts
5. **Built-in Queries**: Access component data via `components.stripe.public.*` queries

## What We Kept Custom

1. **Deposit/Invoice Business Logic**: Our custom deposit → invoice → final payment flow
2. **Custom Invoice Table**: Our `invoices` table with deposit fields remains separate
3. **Payment Methods Management**: Our `paymentMethods` table and logic
4. **Dynamic Amount Checkouts**: Manual API calls for price_data-based checkouts
5. **Invoice Creation After Deposit**: `createStripeInvoiceAfterDeposit` remains custom

## Component Tables Created

The component creates these tables in its namespace:
- `stripe:customers` - Stripe customer records
- `stripe:payments` - Payment intent records
- `stripe:invoices` - Stripe invoice records
- `stripe:checkout_sessions` - Checkout session records

## Environment Variables Required

Make sure these are set in Convex Dashboard:
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (from Stripe Dashboard)

## Webhook Configuration

The component handles webhooks at `/stripe/webhook`. Make sure your Stripe webhook endpoint is configured to:
- URL: `https://<your-deployment>.convex.site/stripe/webhook`
- Events: All the events listed in the component docs (checkout.session.completed, customer.*, invoice.*, payment_intent.*)

## Testing Checklist

- [ ] Verify customer creation works (onboarding flow)
- [ ] Test deposit checkout with priceId
- [ ] Test deposit checkout with dynamic amount (fallback)
- [ ] Verify webhook events are processed correctly
- [ ] Check that component tables are being populated
- [ ] Verify invoice creation after deposit still works
- [ ] Test invoice payment flow

## Next Steps (Optional)

1. **Use Component Queries**: Consider using `components.stripe.public.listPaymentsByUserId` for payment history
2. **Link Component Data**: Link component invoice records to our custom invoices via `stripeInvoiceId`
3. **Remove Old Webhook Handler**: Once verified, we can remove the old `handleWebhook` action (currently kept for backward compatibility)

## Notes

- The old `handleWebhook` action is still present but no longer called from http.ts
- Component's webhook handler verifies signatures automatically
- Custom business logic is preserved in component event handlers
- TypeScript types will be generated when you run `convex dev`
