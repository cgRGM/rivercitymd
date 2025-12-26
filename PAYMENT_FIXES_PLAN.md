# Payment Fixes Plan

## Issues Identified

1. **Analytics showing 0 deposits**: Deposits are being paid in Stripe but not reflected in analytics
2. **Payment button logic**: After deposit is paid, button should show "Pay Invoice" or "Pay Balance"
3. **Webhook handling**: Payment intents from checkout sessions may not have metadata, causing missed updates

## Root Causes

1. **Checkout Session → Payment Intent metadata loss**: When a checkout session completes, it creates a payment intent, but the payment intent may not inherit all metadata from the session
2. **Webhook event order**: `checkout.session.completed` fires before `payment_intent.succeeded`, but we need to ensure both are handled correctly
3. **Analytics query**: Only checks Convex database `depositPaid` field, doesn't verify against Stripe

## Solutions

### 1. Fix Webhook Handler for Payment Intents from Checkout Sessions

**Problem**: Payment intents created by checkout sessions may not have `invoiceId` in metadata.

**Solution**:

- In `payment_intent.succeeded` handler, if metadata is missing, look up the checkout session using `paymentIntent.id`
- Checkout sessions store the payment intent ID, so we can query Stripe for the session
- Extract metadata from the session if payment intent metadata is missing

### 2. Fix Analytics to Query Stripe Directly (Optional Enhancement)

**Problem**: Analytics only check Convex database, which may be out of sync.

**Solution**:

- Option A: Keep analytics querying Convex only, but ensure webhooks always update correctly
- Option B: Add a sync function that queries Stripe for payment intents and updates Convex
- **Recommendation**: Option A - fix webhook handling to ensure data is always in sync

### 3. Fix Payment Button Logic

**Problem**: Button logic needs to properly detect when deposit is paid and show correct button.

**Solution**:

- Check `invoice.depositPaid === true` to show "Pay Balance" or "Pay Invoice"
- If `stripeInvoiceUrl` exists and deposit is paid, show "Pay Invoice" (use Stripe hosted invoice page)
- If `stripeInvoiceUrl` doesn't exist but deposit is paid, show "Pay Balance" (use remaining balance checkout)
- Ensure the button text and action match the invoice state

### 4. Add Payment Intent Lookup from Checkout Session

**Problem**: Need to get checkout session metadata when payment intent doesn't have it.

**Solution**:

- In `payment_intent.succeeded`, if metadata is missing, query Stripe for checkout sessions
- Search for sessions with this payment intent ID
- Extract metadata from the session

## Implementation Steps

1. **Update `payment_intent.succeeded` webhook handler**:
   - If metadata is missing, query Stripe for checkout sessions
   - Look for session with matching payment intent
   - Extract invoiceId and type from session metadata

2. **Update `checkout.session.completed` handler**:
   - Ensure it also stores the payment intent ID for reference
   - Update invoice with both depositPaid and payment intent ID

3. **Fix payment button logic in invoices-client.tsx**:
   - Simplify the conditional logic
   - Show "Pay Deposit" if deposit not paid
   - Show "Pay Invoice" if stripeInvoiceUrl exists and deposit paid
   - Show "Pay Balance" if deposit paid but no stripeInvoiceUrl

4. **Add sync function (optional)**:
   - Create an action to sync payment status from Stripe
   - Can be called manually or scheduled to fix any missed webhooks

## Testing Checklist

- [ ] Deposit payment via checkout updates `depositPaid` correctly
- [ ] Analytics show correct deposit amounts
- [ ] Payment button shows "Pay Deposit" when deposit not paid
- [ ] Payment button shows "Pay Invoice" when deposit paid and invoice exists
- [ ] Payment button shows "Pay Balance" when deposit paid but no invoice URL
- [ ] Webhook handles payment intents from checkout sessions correctly
