# Deposit Checkout Flow Implementation Plan

## Overview

Implement a $50 per vehicle deposit requirement that customers pay during the booking process using Stripe Checkout. The deposit is collected before the appointment is confirmed.

## Current State

- ✅ Deposit fields added to schema
- ✅ Invoice creation calculates deposit amount
- ❌ Deposit is only charged when admin confirms appointment (needs to change)
- ❌ No checkout flow for customers

## Target State

### Customer Booking Flows (Pay Deposit at Booking)

1. **Home Page Booking** (`appointment-modal.tsx`)
   - Customer creates account + appointment
   - System creates invoice with deposit amount
   - Redirect to Stripe Checkout for deposit payment
   - On success: Confirm appointment, mark deposit as paid

2. **Dashboard Booking** (`dashboard-appointment-form.tsx`)
   - Customer creates appointment
   - System creates invoice with deposit amount
   - Redirect to Stripe Checkout for deposit payment
   - On success: Confirm appointment, mark deposit as paid

### Admin Manual Appointment Flow

1. **Admin Creates Appointment** (`schedule-appointment-form.tsx`)
   - Admin creates appointment for customer
   - System creates invoice with deposit amount
   - Send invoice email to customer with deposit payment link
   - Customer pays deposit via link
   - On success: Confirm appointment, mark deposit as paid

## Implementation Steps

### Phase 1: Fix Authentication Error ✅

- [x] Create `getByIdInternal` queries for invoices and appointments
- [x] Update internal actions to use internal queries

### Phase 2: Create Stripe Checkout Action

- [ ] Create `createDepositCheckoutSession` action in `convex/payments.ts`
  - Takes: `appointmentId`, `invoiceId`, `successUrl`, `cancelUrl`
  - Creates Stripe Checkout session for deposit amount
  - Returns checkout session URL
  - Metadata includes: `appointmentId`, `invoiceId`, `type: "deposit"`

### Phase 3: Modify Appointment Creation

- [ ] Update `appointments.create` mutation:
  - Create invoice immediately with deposit amount
  - Set appointment status to "pending" (not "confirmed")
  - Return `appointmentId` and `invoiceId`
- [ ] Update `users.createUserAndAppointment` mutation:
  - Create invoice immediately with deposit amount
  - Return `appointmentId` and `invoiceId`

### Phase 4: Update Customer Booking Flows

- [ ] **Home Page Flow** (`appointment-modal.tsx`):
  - After `createUserAndAppointment`, call `createDepositCheckoutSession`
  - Redirect to Stripe Checkout URL
  - On return from checkout, check payment status

- [ ] **Dashboard Flow** (`dashboard-appointment-form.tsx`):
  - After `createAppointment`, create invoice if not auto-created
  - Call `createDepositCheckoutSession`
  - Redirect to Stripe Checkout URL

### Phase 5: Checkout Success Handler

- [ ] Create `/api/checkout/success` route handler
  - Verify checkout session
  - Update invoice: mark deposit as paid
  - Confirm appointment (status: "confirmed")
  - Redirect to success page

- [ ] Create `/api/checkout/cancel` route handler
  - Keep appointment as "pending"
  - Show message that deposit is required

### Phase 6: Update Webhook Handler

- [ ] Update `handleWebhook` in `convex/payments.ts`:
  - Handle `checkout.session.completed` for deposits
  - Update invoice deposit status
  - Confirm appointment if deposit paid

### Phase 7: Admin Manual Appointment Flow

- [ ] Update admin appointment creation:
  - Create invoice with deposit
  - Generate deposit payment link
  - Send email to customer with:
    - Invoice details
    - Deposit payment link
    - Instructions

### Phase 8: Remove Auto-Charge on Confirmation

- [ ] Remove deposit charging from `updateStatus` mutation
- [ ] Keep final payment charging when appointment completed

## Technical Details

### Stripe Checkout Session Structure

```typescript
{
  mode: "payment",
  customer: stripeCustomerId,
  amount: depositAmount * 100, // in cents
  currency: "usd",
  success_url: `${siteUrl}/dashboard/appointments?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${siteUrl}/dashboard/appointments?canceled=true`,
  metadata: {
    appointmentId: string,
    invoiceId: string,
    type: "deposit"
  }
}
```

### Invoice Status Flow

1. **Created**: `status: "draft"`, `depositPaid: false`
2. **Deposit Paid**: `status: "sent"`, `depositPaid: true`
3. **Fully Paid**: `status: "paid"`, `depositPaid: true`

### Appointment Status Flow

1. **Created**: `status: "pending"` (waiting for deposit)
2. **Deposit Paid**: `status: "confirmed"` (automatically updated)
3. **Service Complete**: `status: "completed"` (final payment charged)

## Files to Modify

### Backend (Convex)

- `convex/payments.ts`: Add `createDepositCheckoutSession` action
- `convex/appointments.ts`:
  - Modify `create` to create invoice immediately
  - Remove deposit charging from `updateStatus`
- `convex/invoices.ts`: Already has deposit fields ✅
- `convex/users.ts`: Modify `createUserAndAppointment` if needed

### Frontend (Next.js)

- `components/home/appointment-modal.tsx`: Add checkout redirect
- `components/forms/dashboard/dashboard-appointment-form.tsx`: Add checkout redirect
- `components/forms/dashboard/schedule-appointment-form.tsx`: Add email sending
- `app/api/checkout/success/route.ts`: New file for success handler
- `app/api/checkout/cancel/route.ts`: New file for cancel handler

## Testing Checklist

- [ ] Customer can book appointment and pay deposit
- [ ] Appointment is confirmed after deposit payment
- [ ] Invoice shows deposit as paid
- [ ] Admin can create appointment and customer receives email
- [ ] Customer can pay deposit from email link
- [ ] Final payment is charged when appointment completed
- [ ] Webhook handles checkout.session.completed correctly
