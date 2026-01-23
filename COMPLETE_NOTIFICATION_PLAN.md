# Complete Notification and Payment Fix Plan

## Overview

Fix payment flow issues and implement comprehensive notification system with badges and emails using:
- **Stripe Component**: Payment notifications (automatic via webhooks)
- **Resend Component**: Business notifications (appointments, reviews, etc.)

## Critical Fixes (Phase 1)

### 1.1 Fix Authentication Errors
**Files**: `convex/appointments.ts` (lines 1085, 1207)
- Change `api.users.getById` → `internal.users.getByIdInternal` in `chargeDeposit` and `chargeFinalPayment`

### 1.2 Simplify Final Payment Flow
**File**: `convex/appointments.ts` (lines 1183-1242)
- Remove Payment Intent creation from `chargeFinalPayment`
- Final payment uses existing Stripe Invoice (created after deposit)
- Just verify invoice exists and is ready

## Customer Badges (Phase 2)

### 2.1 Add Count Queries

**File**: `convex/appointments.ts`
```typescript
// Get count of confirmed appointments for current user
export const getConfirmedAppointmentsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) return 0;
    
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .collect();
    
    return appointments.length;
  },
});
```

**File**: `convex/invoices.ts`
```typescript
// Get count of unpaid invoices with deposit paid (for customer)
export const getUnpaidInvoicesCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) return 0;
    
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.neq(q.field("status"), "paid"),
          q.eq(q.field("depositPaid"), true)
        )
      )
      .collect();
    
    return invoices.length;
  },
});
```

**File**: `convex/reviews.ts`
```typescript
// Get count of pending reviews (completed appointments without reviews)
export const getPendingReviewsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) return 0;
    
    const pendingReviews = await ctx.runQuery(api.reviews.getPendingReviews, {});
    return pendingReviews.length;
  },
});
```

### 2.2 Update Customer Sidebar

**File**: `components/dashboard/dashboard-sidebar.tsx`
- Add queries: `getConfirmedAppointmentsCount`, `getUnpaidInvoicesCount`, `getPendingReviewsCount`
- Display badges on:
  - "My Appointments" (confirmed count)
  - "My Invoices" (unpaid invoices with deposit paid)
  - "My Reviews" (pending reviews count)

### 2.3 Update Customer Mobile Nav

**File**: `components/dashboard/dashboard-mobile-nav.tsx` (if exists)
- Add same queries and badges

## Admin Badges (Phase 3)

### 3.1 Add Count Queries

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
      .filter((q) => q.neq(q.field("status"), "paid"))
      .collect();
    return invoices.length;
  },
});
```

**File**: `convex/reviews.ts`
```typescript
// Get count of new reviews (last 7 days, admin only)
export const getNewReviewsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const reviews = await ctx.db
      .query("reviews")
      .filter((q) => q.gte(q.field("_creationTime"), sevenDaysAgo))
      .collect();
    return reviews.length;
  },
});
```

### 3.2 Update Admin Sidebar

**File**: `components/admin/admin-sidebar.tsx`
- Add queries: `getUnpaidInvoicesCountAdmin`, `getNewReviewsCount`
- Display badges on:
  - "Payments" (unpaid invoices)
  - "Reviews" (new reviews)

### 3.3 Update Admin Mobile Nav

**File**: `components/admin/admin-mobile-nav.tsx`
- Add same queries and badges

## Email Notifications via Resend (Phase 4)

### 4.1 Email Functions to Add

**File**: `convex/emails.tsx`

1. **`sendAdminNewCustomerNotification`**
   - Trigger: After customer completes onboarding
   - Content: Customer name, email, signup date, vehicles added
   - Send to: Admin email

2. **`sendAdminReviewSubmittedNotification`**
   - Trigger: When `reviews.submit` mutation is called
   - Content: Customer name, rating, review text, appointment details
   - Send to: Admin email

3. **`sendCustomerReviewRequestEmail`**
   - Trigger: When appointment status changes to "completed"
   - Content: Thank you message, link to leave review
   - Send to: Customer email

### 4.2 Integrate Email Calls

**File**: `convex/users.ts` (onboarding completion)
- Add email call in `createUserProfile` or after onboarding complete

**File**: `convex/reviews.ts` (review submission)
- Add email call in `submit` mutation

**File**: `convex/appointments.ts` (appointment completion)
- Add email call when status changes to "completed"
- Send review request email to customer

**File**: `convex/http.ts` (Clerk webhook)
- Add email call in `user.created` handler (only if onboarding complete)

### 4.3 Verify Existing Emails

**File**: `convex/emails.tsx`
- Verify `sendAppointmentConfirmationEmail` is called when appointment confirmed
- Verify `sendAdminAppointmentNotification` is called for all appointment events

## Admin Invoice View (Phase 5)

### 5.1 Use Stripe Component Queries

**File**: `components/admin/payments-client.tsx`
- Query Stripe invoices: `components.stripe.public.listInvoices`
- Display Stripe invoice data (status, amount, customer, date)
- Link to Stripe dashboard for full details
- Keep custom invoice queries for business logic (deposits, appointments)

### 5.2 Hybrid Display
- Show Stripe invoice as primary (source of truth for payment)
- Show custom invoice data for business context (appointment, services, etc.)
- Link via `stripeInvoiceId` field

## Payment Button Fixes (Phase 6)

### 6.1 Update Customer Invoice View

**File**: `components/dashboard/invoices-client.tsx`
- Check if invoice is already paid → hide payment buttons
- Check if `stripeInvoiceUrl` exists → show "Pay Invoice" button
- Handle edge case: invoice not created yet → show disabled button
- After completion: Still allow payment if invoice not paid

## Implementation Summary

### Badges

**Customer Sidebar:**
- ✅ Confirmed Appointments count
- ✅ Unpaid Invoices count (with deposit paid)
- ✅ Pending Reviews count

**Admin Sidebar:**
- ✅ Pending Appointments count (already exists)
- ✅ New Customers count (already exists)
- ✅ Unpaid Invoices count
- ✅ New Reviews count

### Email Notifications (Resend)

**Admin Receives:**
- ✅ New customer signup (after onboarding)
- ✅ Appointment created (already exists)
- ✅ Appointment updated (already exists)
- ✅ Appointment cancelled (already exists)
- ✅ Review submitted

**Customer Receives:**
- ✅ Appointment confirmed (verify it's called)
- ✅ Review requested (after appointment completed)

**Note**: Payment notifications (deposit paid, invoice paid) handled by Stripe webhooks - no Resend emails needed

## Testing Checklist

### Payment Flow
- [ ] Appointment completion doesn't throw auth error
- [ ] Final payment uses Stripe Invoice (no Payment Intent)
- [ ] Customer payment buttons work after completion
- [ ] Stripe webhook updates status correctly

### Customer Badges
- [ ] Confirmed appointments badge shows
- [ ] Unpaid invoices badge shows (after deposit paid)
- [ ] Pending reviews badge shows (after appointment completed)

### Admin Badges
- [ ] Pending appointments badge ✅ (exists)
- [ ] New customers badge ✅ (exists)
- [ ] Unpaid invoices badge
- [ ] New reviews badge

### Email Notifications
- [ ] Admin receives email for new customer
- [ ] Admin receives email for review submitted
- [ ] Customer receives email for appointment confirmed
- [ ] Customer receives email requesting review (after completion)

### Admin Invoice View
- [ ] Admin sees Stripe invoices from component
- [ ] Admin can link to Stripe dashboard
- [ ] Custom invoice data still accessible

## Files to Modify

1. `convex/appointments.ts` - Fix auth errors, add count queries, add email calls
2. `convex/invoices.ts` - Add count queries
3. `convex/reviews.ts` - Add count queries, add email call
4. `convex/users.ts` - Add email call for new customer
5. `convex/emails.tsx` - Add new email functions
6. `convex/http.ts` - Add email call in Clerk webhook
7. `components/dashboard/dashboard-sidebar.tsx` - Add badges
8. `components/admin/admin-sidebar.tsx` - Add badges
9. `components/admin/admin-mobile-nav.tsx` - Add badges
10. `components/dashboard/invoices-client.tsx` - Fix payment buttons
11. `components/admin/payments-client.tsx` - Use Stripe component queries
