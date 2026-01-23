# Payment Flow Fixes and Notification System

## Issues to Fix

1. **Authentication Error**: `chargeFinalPayment` calls `api.users.getById` from `internalAction` (no auth context)
2. **Inconsistent Final Payment Flow**: Code creates Payment Intents, but should use existing Stripe Invoice
3. **Missing Invoice Notifications**: No badge when new invoice generated after deposit
4. **Admin Viewing Custom Invoices**: Should see Stripe invoices from component
5. **Missing Admin Notifications**: Need badges and emails for all customer actions
6. **Missing Customer Notifications**: Need badges for appointments, invoices, reviews

## Notification Strategy

### Stripe (Payment Notifications)
- **Handles**: Payment webhooks automatically via component
- **Events**: `invoice.paid`, `payment_intent.succeeded`, `checkout.session.completed`
- **Action**: Component syncs data, custom handlers update business logic
- **No Email Needed**: Stripe handles payment notifications

### Resend (Business Notifications)
- **Handles**: Appointments, reviews, business events
- **Admin Emails**: New customer, appointment created/updated/cancelled, review submitted
- **Customer Emails**: Appointment confirmed, review requested (after completion)
- **Production**: Set `RESEND_API_KEY` in Convex Dashboard

## Customer Actions That Trigger Notifications

### Admin Notifications (Badge + Email via Resend)
1. **New Customer Signup** ✅ (badge exists, email needed)
2. **Appointment Created** ✅ (badge exists, email exists)
3. **Appointment Updated** ✅ (email exists)
4. **Appointment Cancelled** ✅ (email exists)
5. **New Payment** ❌ (badge needed - unpaid invoices count)
6. **Review Submitted** ❌ (badge + email needed)

### Customer Notifications (Badge Only)
1. **Appointment Confirmed** ❌ (badge needed - confirmed appointments)
2. **New Invoice** ❌ (badge needed - unpaid invoices with deposit paid)
3. **Review Ready** ❌ (badge needed - pending reviews count)

## Implementation Plan

### Phase 1: Fix Critical Payment Issues

#### 1.1 Fix Authentication Errors
- **File**: `convex/appointments.ts`
- **Lines**: 1085, 1207
- **Change**: Use `internal.users.getByIdInternal` instead of `api.users.getById`

#### 1.2 Simplify Final Payment Flow
- **File**: `convex/appointments.ts` (lines 1183-1242)
- **Remove**: Payment Intent creation for final payment
- **Keep**: Stripe Invoice approach (already created after deposit)
- **Logic**: Just verify invoice exists and is ready for payment

### Phase 2: Add Customer Notification Badges

#### 2.1 Customer Invoice Badge
- **File**: `convex/invoices.ts`
- **Add Query**: `getUnpaidInvoicesCount` - Count invoices with `status !== "paid"` and `depositPaid === true`
- **File**: `components/dashboard/dashboard-sidebar.tsx`
- **Add**: Badge on "My Invoices" menu item

#### 2.2 Customer Appointment Confirmed Badge
- **File**: `convex/appointments.ts`
- **Add Query**: `getConfirmedAppointmentsCount` - Count appointments with `status === "confirmed"`
- **File**: `components/dashboard/dashboard-sidebar.tsx`
- **Add**: Badge on "My Appointments" menu item

#### 2.3 Customer Review Ready Badge
- **File**: `convex/reviews.ts`
- **Use Existing**: `getPendingReviews` query (already exists)
- **Add Query**: `getPendingReviewsCount` - Count pending reviews
- **File**: `components/dashboard/dashboard-sidebar.tsx`
- **Add**: Badge on "My Reviews" menu item

### Phase 3: Admin Notification Badges

#### 3.1 Add Count Queries

**File**: `convex/invoices.ts`
```typescript
// Get count of unpaid invoices (admin only)
export const getUnpaidInvoicesCountAdmin = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_status", (q) => q.neq("status", "paid"))
      .collect();
    return invoices.length;
  },
});
```

**File**: `convex/reviews.ts`
```typescript
// Get count of new/unread reviews (admin only)
export const getNewReviewsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Count reviews from last 7 days that admin hasn't seen
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const reviews = await ctx.db
      .query("reviews")
      .filter((q) => q.gte(q.field("_creationTime"), sevenDaysAgo))
      .collect();
    return reviews.length;
  },
});
```

#### 3.2 Update Admin Sidebar

**File**: `components/admin/admin-sidebar.tsx`
- Add `unpaidInvoicesCount` query
- Add `newReviewsCount` query
- Display badges on "Payments" and "Reviews" menu items

#### 3.3 Update Admin Mobile Nav

**File**: `components/admin/admin-mobile-nav.tsx`
- Add same count queries
- Display badges on mobile navigation

### Phase 4: Email Notifications via Resend

**Note**: Stripe handles payment notifications automatically. Resend is for business events only.

#### 4.1 Email Functions to Add

**File**: `convex/emails.tsx`

1. **`sendAdminNewCustomerNotification`**
   - Trigger: When new customer signs up (Clerk webhook `user.created`)
   - Content: Customer name, email, signup date
   - **Note**: Only send if customer completes onboarding

2. **`sendAdminReviewSubmittedNotification`**
   - Trigger: When customer submits a review (`reviews.submit` mutation)
   - Content: Customer name, rating, review text, appointment details
   - Link to review in admin dashboard

3. **`sendCustomerAppointmentConfirmedEmail`**
   - Trigger: When appointment status changes to "confirmed" (after deposit paid)
   - Content: Appointment date, time, services, location
   - **Note**: Already exists as `sendAppointmentConfirmationEmail` - verify it's called

4. **`sendCustomerReviewRequestEmail`**
   - Trigger: When appointment is completed (status = "completed")
   - Content: Thank you message, link to leave review
   - **Note**: Send after service completion, not immediately

#### 4.2 Integrate Email Calls

**File**: `convex/http.ts` (Clerk webhook)
- Add email call in `user.created` handler (new customer - only if onboarding complete)

**File**: `convex/reviews.ts` (review submission)
- Add email call in `submit` mutation when review is created

**File**: `convex/appointments.ts` (appointment status)
- Verify `sendAppointmentConfirmationEmail` is called when status = "confirmed"
- Add `sendCustomerReviewRequestEmail` when status = "completed"

#### 4.3 Email Configuration

- **From**: `notifications@rivercitymd.com` (already configured)
- **To Admin**: Get from business settings or use hardcoded email for now
- **To Customer**: Use customer's email from user record
- **Template**: Professional HTML emails with business branding
- **Production**: Ensure `RESEND_API_KEY` is set in Convex Dashboard
- **Test Mode**: Component uses test mode when no API key (safe for development)

### Phase 5: Update Admin Invoice View

#### 5.1 Use Stripe Component Queries

**File**: `components/admin/payments-client.tsx`
- Query Stripe invoices: `components.stripe.public.listInvoices`
- Display Stripe invoice data (status, amount, customer)
- Link to Stripe dashboard for full details
- Keep custom invoice queries for business logic (deposits, etc.)

#### 5.2 Hybrid Approach
- **Stripe Component**: Source of truth for payment data
- **Custom Invoices**: Business logic (deposits, appointments, etc.)
- **Link**: Via `stripeInvoiceId` field

### Phase 6: Fix Payment Button Logic

#### 6.1 Update Customer Invoice View

**File**: `components/dashboard/invoices-client.tsx`
- Check if invoice is already paid (hide payment buttons)
- Check if `stripeInvoiceUrl` exists (show "Pay Invoice" button)
- Handle edge case: invoice not created yet (show disabled button with message)
- After completion: Still allow payment if invoice not paid

## Subscriptions (Future Consideration)

**Current Status**: Not implemented yet, but Stripe component supports subscriptions

**When Ready**:
- Use `stripeClient.createCheckoutSession` with `mode: "subscription"`
- Component automatically handles subscription webhooks
- Use `components.stripe.public.listSubscriptionsByUserId` for customer subscriptions
- Admin can view subscriptions via component queries

**Note**: Keep subscription logic separate from one-time payment flow

## Testing Checklist

### Payment Flow
- [ ] Appointment completion doesn't throw auth error
- [ ] Final payment uses Stripe Invoice (no Payment Intent created)
- [ ] Customer payment buttons work after completion
- [ ] Stripe Invoice webhook updates status correctly

### Notifications

**Customer Badges:**
- [ ] Appointment confirmed badge (confirmed appointments)
- [ ] Invoice badge (unpaid invoices with deposit paid)
- [ ] Review ready badge (pending reviews count)

**Admin Badges:**
- [ ] Appointments (pending) ✅ (already exists)
- [ ] Customers (new) ✅ (already exists)
- [ ] Payments (unpaid invoices)
- [ ] Reviews (new)

**Admin Emails via Resend:**
- [ ] New customer signup (after onboarding)
- [ ] Appointment created ✅ (already exists)
- [ ] Appointment updated ✅ (already exists)
- [ ] Appointment cancelled ✅ (already exists)
- [ ] Review submitted

**Customer Emails via Resend:**
- [ ] Appointment confirmed ✅ (verify it's called)
- [ ] Review requested (after appointment completed)

**Note**: Payment notifications (deposit paid, invoice paid) are handled by Stripe webhooks - no Resend emails needed

### Admin View
- [ ] Admin can see Stripe invoices
- [ ] Admin can link to Stripe dashboard
- [ ] Custom invoice data still accessible

## Implementation Order

1. **Critical Fixes** (Phase 1) - Fix auth errors and payment flow
2. **Customer Notifications** (Phase 2) - Invoice badge for customers
3. **Admin Badges** (Phase 3) - All admin notification badges
4. **Email Notifications** (Phase 4) - Resend emails for all actions
5. **Admin Invoice View** (Phase 5) - Use Stripe component data
6. **Payment Button Fixes** (Phase 6) - Handle edge cases
