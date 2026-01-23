# Stripe Invoice Refactoring Summary

## Overview
Refactored the payment system to use **Stripe Invoices as the primary system** for managing payments after deposits, simplifying the codebase and leveraging Stripe's automatic charging capabilities.

## Key Changes

### 1. New Invoice Creation Flow
- **After deposit payment**: When a customer pays the deposit via Checkout Session, the system now automatically creates a Stripe Invoice with:
  - All service line items (using Stripe Price IDs)
  - Deposit as a credit/adjustment line item (negative amount)
  - Automatic charging if customer has a card on file
  - Automatic finalization and sending

### 2. Simplified Webhook Handlers
- **`checkout.session.completed`**: Now only handles deposit payments and triggers Stripe Invoice creation
- **`invoice.paid`**: Primary handler for final payments - updates invoice status and user stats
- **`payment_intent.succeeded`**: Simplified to only handle deposit payments as a backup

### 3. Removed Code
- **`createRemainingBalanceCheckoutSession`**: Removed - customers now pay via Stripe's hosted invoice page
- **Final Payment Intent creation**: Removed - Stripe Invoices handle final payments automatically
- **Complex Payment Intent handlers**: Simplified to focus on invoice events

### 4. Frontend Updates
- Updated `components/dashboard/invoices-client.tsx` to use `stripeInvoiceUrl` for remaining balance payments
- Removed dependency on `createRemainingBalanceCheckoutSession` action

## New Flow

### Step 1: Customer Creates Appointment
1. Customer selects services and vehicles
2. Convex invoice record created (status: `draft`)
3. Deposit amount calculated
4. Customer redirected to Stripe Checkout for deposit

### Step 2: Deposit Paid
1. Webhook `checkout.session.completed` fires
2. Deposit marked as paid in Convex
3. Appointment auto-confirmed
4. **NEW**: Stripe Invoice automatically created with:
   - All service line items
   - Deposit as credit line item
   - Automatic charging if card on file
   - Invoice finalized and sent

### Step 3: Final Payment
**Option A: Automatic (if card on file)**
- Stripe automatically charges the invoice when finalized
- Webhook `invoice.paid` fires
- Invoice status updated to `paid`
- User stats updated

**Option B: Manual (no card on file)**
- Customer receives invoice email from Stripe
- Customer clicks link to Stripe's hosted invoice page
- Customer pays via hosted page
- Webhook `invoice.paid` fires
- Invoice status updated to `paid`
- User stats updated

**Option C: Customer Pays Early**
- Customer can visit `stripeInvoiceUrl` anytime after deposit
- Can pay full remaining balance before service completion
- Same webhook flow applies

## Benefits

1. **Single Source of Truth**: Stripe Invoice is the authoritative record
2. **Automatic Charging**: Stripe handles charging when card is on file
3. **Automatic Emails**: Stripe sends invoice emails automatically
4. **Simpler Webhooks**: Only handle `invoice.paid` for final payments
5. **Less Code**: Removed ~200 lines of Payment Intent complexity
6. **Better UX**: Customers get proper Stripe invoices with hosted payment pages

## Technical Details

### New Function: `createStripeInvoiceAfterDeposit`
- **Location**: `convex/payments.ts`
- **Type**: `internalAction`
- **Purpose**: Creates Stripe Invoice with all line items after deposit is paid
- **Features**:
  - Checks if customer has default payment method
  - Uses `charge_automatically` if card on file, else `send_invoice`
  - Adds deposit as negative invoice item (credit)
  - Finalizes and sends invoice automatically

### Updated Webhook Handler
- **`checkout.session.completed`**: Creates Stripe Invoice after deposit
- **`invoice.paid`**: Updates invoice status and user stats
- **`payment_intent.succeeded`**: Backup handler for deposits only

## Migration Notes

- Existing invoices with `finalPaymentIntentId` will continue to work
- New invoices will use Stripe Invoice system
- `finalPaymentIntentId` field remains in schema for backward compatibility
- Frontend automatically uses `stripeInvoiceUrl` when available

## Testing Checklist

- [ ] Deposit payment creates Stripe Invoice
- [ ] Invoice includes all service line items
- [ ] Deposit is correctly applied as credit
- [ ] Automatic charging works when card is on file
- [ ] Manual payment via hosted invoice page works
- [ ] Webhook `invoice.paid` updates status correctly
- [ ] User stats update when invoice is paid
- [ ] Customer can pay early via invoice URL

