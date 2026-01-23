# Analysis: @convex-dev/stripe Component for Invoice Flow

## Current Implementation

Your current payment system uses:
1. **Stripe Checkout Sessions** - For deposit payments
2. **Stripe Invoices** - Created manually via API calls with Invoice Items
3. **Payment Intents** - For some direct payments
4. **Manual Webhook Handling** - Custom webhook handler in `convex/payments.ts`

## What @convex-dev/stripe Provides

Based on the [Convex Stripe Component documentation](https://docs.convex.dev/components/stripe):

### ✅ What It Offers:
- **Checkout Sessions** - Simplified creation and management
- **Subscription Management** - Full subscription lifecycle
- **Customer Management** - Customer CRUD operations
- **Customer Portal** - Pre-built portal for customers to manage subscriptions
- **Webhook Handling** - Simplified webhook verification and routing
- **Real-time Data Sync** - Automatic sync of Stripe data to Convex tables

### ❌ What It Doesn't Provide:
- **Stripe Invoice Creation** - No helpers for creating invoices
- **Invoice Item Management** - No helpers for adding line items to invoices
- **Automatic Invoice Charging** - No specific support for invoice-based payments
- **Deposit + Final Payment Flow** - Not designed for this pattern

## Key Finding

**The component is focused on subscriptions and one-time payments via Checkout, not invoices.**

Your requirements:
- ✅ Deposit first (via Checkout or Invoice)
- ✅ Then create Stripe Invoice with line items
- ✅ Automatic charging when card is on file
- ✅ Customer can pay full amount after deposit or after service

**These are all native Stripe Invoice features, but the component doesn't provide helpers for them.**

## Recommendation

### ❌ Don't Use @convex-dev/stripe Component

**Reasons:**
1. **No Invoice Support** - The component doesn't help with your core need (Stripe Invoices)
2. **You Already Have Checkout** - Your current Checkout Session implementation works fine
3. **Webhook Handling is Simple** - Your current webhook handler is straightforward
4. **Additional Complexity** - Adding the component would add dependencies without solving your main problem

### ✅ Instead: Simplify Your Current Implementation

**What to Keep:**
- Stripe Checkout Sessions for deposits (already working)
- Stripe Invoice API calls (already working)
- Webhook handling (already working)

**What to Simplify:**
1. **Use Stripe Invoices as Primary System**
   - Create invoice immediately after deposit is paid
   - Add all line items (services) to the invoice
   - Use `auto_advance: true` for automatic charging
   - Use `collection_method: "charge_automatically"` if card is on file

2. **Remove Payment Intent Complexity**
   - Don't create Payment Intents for final payment
   - Let Stripe Invoices handle charging automatically
   - Only use Payment Intents if customer doesn't have a card on file

3. **Simplify Webhook Handling**
   - Focus on `invoice.paid` and `invoice.payment_succeeded`
   - Remove `payment_intent.succeeded` handlers (if using invoices)
   - Keep `checkout.session.completed` for deposits

## Proposed Simplified Flow

### 1. Customer Creates Appointment
- Create Convex invoice record (draft)
- Calculate deposit amount
- Create Stripe Checkout Session for deposit

### 2. Deposit Paid (Checkout Session Completed)
- Mark deposit as paid in Convex
- Create Stripe Invoice with all service line items
- Add deposit as a credit/adjustment line item (or subtract from total)
- Set `collection_method: "charge_automatically"` if card on file
- Set `auto_advance: true` for automatic finalization
- Finalize and send invoice

### 3. Service Completed
- If card is on file: Stripe automatically charges the invoice
- If no card: Customer pays via hosted invoice page
- Webhook `invoice.paid` updates Convex status

### 4. Customer Can Pay Early
- Customer can visit hosted invoice URL anytime
- Pay full remaining balance before service completion

## Benefits of This Approach

1. **Single Source of Truth** - Stripe Invoice is the authoritative record
2. **Automatic Charging** - Stripe handles it when card is on file
3. **Automatic Emails** - Stripe sends invoice emails
4. **Simpler Webhooks** - Only handle `invoice.paid` and `invoice.payment_succeeded`
5. **Less Code** - No manual Payment Intent creation for final payment
6. **Better UX** - Customers get proper Stripe invoices

## Next Steps

1. Refactor to use Stripe Invoices as primary system
2. Remove Payment Intent creation for final payments
3. Simplify webhook handlers to focus on invoice events
4. Use Stripe's hosted invoice pages for customer payments
5. Leverage automatic charging when card is on file

