# Admin Improvements & Fixes Plan

## Overview

This plan outlines improvements to the admin dashboard, invoice payment flow, reviews visibility, and dashboard display fixes.

---

## 1. Admin Navigation Count Badges

### Goal

Add count badges to admin navigation items showing:

- **Appointments**: Number of pending appointments
- **Customers**: Number of new customers (created in last 30 days)

### Implementation Steps

#### 1.1 Create Count Queries (`convex/appointments.ts`)

- `getPendingCount`: Query to count appointments with status "pending"
- Admin-only query

#### 1.2 Create Count Queries (`convex/users.ts`)

- `getNewCustomersCount`: Query to count customers created in last 30 days
- Admin-only query
- Filter by role !== "admin" and `_creationTime` within last 30 days

#### 1.3 Update AdminSidebar Component

- Add `useQuery` hooks for both counts
- Display badge on menu items when count > 0
- Use Badge component with red background for visibility
- Position badge on top-right of menu item icon

#### 1.4 Update AdminMobileNav Component

- Add same count queries
- Display badges on mobile navigation items

---

## 2. Invoice Payment Flow Improvements

### Goal

- Show remaining balance (total - deposit) in invoice preview
- Ensure Stripe invoice URL works for payment
- Display deposit information clearly
- Allow customers to pay remaining balance via Stripe

### Implementation Steps

#### 2.1 Update Invoice Preview Component (`components/dashboard/invoices-client.tsx`)

- Add deposit amount display in invoice preview
- Show "Deposit Paid" status if `depositPaid === true`
- Calculate and display remaining balance: `total - depositAmount`
- Update total line to show breakdown:
  - Subtotal
  - Tax
  - Deposit (if paid, show as negative or separate line)
  - **Remaining Balance** (bold, highlighted)

#### 2.2 Update Invoice Table Display

- Add deposit status column or badge
- Show remaining balance instead of total for unpaid invoices
- Update "Pay Now" button logic:
  - If deposit not paid: Show "Pay Deposit" button
  - If deposit paid but invoice not paid: Show "Pay Remaining Balance" button
  - Use `stripeInvoiceUrl` if available, otherwise create checkout session

#### 2.3 Create Payment Action for Remaining Balance (`convex/payments.ts`)

- `createRemainingBalanceCheckoutSession`: Action to create Stripe checkout for remaining balance
- Use `remainingBalance` from invoice
- Link to invoice and appointment in metadata

#### 2.4 Update Invoice Queries

- Ensure `getUserInvoices` includes deposit fields
- Add deposit information to invoice type

---

## 3. Reviews Visibility in Admin

### Goal

- Create admin reviews page
- Display all reviews with customer names, ratings, and comments
- Add to admin navigation

### Implementation Steps

#### 3.1 Create Admin Reviews Query (`convex/reviews.ts`)

- `listForAdmin`: Query to get all reviews with customer and appointment details
- Admin-only access
- Join with users and appointments tables
- Return: review data + customer name + appointment details

#### 3.2 Create Admin Reviews Component (`components/admin/reviews-client.tsx`)

- Display reviews in a table or card layout
- Show: Customer name, Rating (stars), Comment, Date, Appointment details
- Filter options: All, Public only, By rating
- Search functionality

#### 3.3 Create Admin Reviews Page (`app/admin/reviews/page.tsx`)

- Simple page wrapper for ReviewsClient component

#### 3.4 Update Admin Navigation

- Add "Reviews" menu item to AdminSidebar
- Add "Reviews" to AdminMobileNav
- Use Star icon from lucide-react

---

## 4. Fix Dashboard Client - Show Customer Names

### Goal

- Fix `getUpcoming` query to include customer names
- Update dashboard display to show customer name instead of user ID

### Implementation Steps

#### 4.1 Update `getUpcoming` Query (`convex/appointments.ts`)

- Join with users table to get customer names
- Return enriched appointments with user name
- Keep existing filtering and sorting logic

#### 4.2 Update Dashboard Client Component (`components/admin/dashboard-client.tsx`)

- Update appointment display to show customer name
- Replace "User ID: {appointment.userId}" with "Customer: {appointment.userName}"
- Handle case where user might not exist (show "Unknown Customer")

---

## 5. Customer Detail Pages

### Goal

- Make customer cards clickable in admin/customers
- Create customer detail page showing customer information and all their appointments
- Add navigation to customer detail page

### Implementation Steps

#### 5.1 Create Customer Detail Query (`convex/users.ts`)

- `getByIdWithDetails`: Query to get customer with all appointments, invoices, and vehicles
- Admin-only access
- Return: customer data + appointments array + invoices array + vehicles array

#### 5.2 Create Customer Detail Component (`components/admin/customer-detail-client.tsx`)

- Display customer information (name, email, phone, address)
- Show customer stats (total spent, times serviced, customer since)
- List all appointments with status, date, services, vehicles
- List all invoices with status, amount, payment info
- Show vehicles owned by customer
- Add back button to return to customers list

#### 5.3 Create Customer Detail Page (`app/admin/customers/[id]/page.tsx`)

- Dynamic route for customer detail
- Extract customer ID from params
- Render CustomerDetailClient component

#### 5.4 Update Customers Client Component (`components/admin/customers-client.tsx`)

- Make customer cards clickable (add Link or onClick handler)
- Navigate to `/admin/customers/[id]` when card is clicked
- Add hover effect to indicate clickability

---

## 6. Add Deposits Metric to Analytics

### Goal

- Add deposits collected as a metric in analytics dashboard
- Show total deposits, deposits this month, and trend

### Implementation Steps

#### 6.1 Update Analytics Query (`convex/analytics.ts`)

- Add deposit calculations to `getMonthlyStats`:
  - Total deposits collected
  - Deposits this month
  - Deposits last month
  - Deposit change percentage
- Query invoices where `depositPaid === true`
- Sum `depositAmount` for calculations

#### 6.2 Update Analytics Client Component (`components/admin/analytics-client.tsx`)

- Add deposit metric card to stats grid
- Display: Total Deposits, Deposits This Month, Change %
- Use DollarSign or CreditCard icon
- Show trend indicator (up/down)

---

## 7. Additional Improvements

### 7.1 Invoice Status Updates

- Ensure invoice status updates correctly when deposit is paid
- Ensure invoice status updates when final payment is made
- Add visual indicators for deposit status

### 7.2 Error Handling

- Add error handling for missing Stripe invoice URLs
- Add fallback payment options if Stripe invoice not available
- Show helpful error messages to users

### 7.3 Stripe Invoice Payment Integration

- Use Stripe's hosted invoice page for payment (as per Stripe docs)
- Ensure `stripeInvoiceUrl` is properly set when invoice is sent
- Handle `invoice.paid` webhook events
- Support partial payments if needed

---

## File Changes Summary

### New Files

- `app/admin/reviews/page.tsx`
- `components/admin/reviews-client.tsx`
- `app/admin/customers/[id]/page.tsx`
- `components/admin/customer-detail-client.tsx`

### Modified Files

- `convex/appointments.ts` - Add `getPendingCount`, update `getUpcoming`
- `convex/users.ts` - Add `getNewCustomersCount`, add `getByIdWithDetails`
- `convex/reviews.ts` - Add `listForAdmin` query
- `convex/payments.ts` - Add `createRemainingBalanceCheckoutSession` action
- `convex/invoices.ts` - Ensure deposit fields are included in queries
- `convex/analytics.ts` - Add deposit calculations to `getMonthlyStats`
- `components/admin/admin-sidebar.tsx` - Add count badges
- `components/admin/admin-mobile-nav.tsx` - Add count badges
- `components/admin/dashboard-client.tsx` - Fix customer name display
- `components/admin/customers-client.tsx` - Make cards clickable, add navigation
- `components/admin/analytics-client.tsx` - Add deposits metric card
- `components/dashboard/invoices-client.tsx` - Update invoice preview and payment flow

---

## Testing Checklist

- [ ] Pending appointments count shows correctly in admin nav
- [ ] New customers count shows correctly in admin nav
- [ ] Badges disappear when counts are 0
- [ ] Invoice preview shows deposit and remaining balance correctly
- [ ] Payment buttons work for both deposit and remaining balance
- [ ] Reviews page displays all reviews with customer names
- [ ] Dashboard shows customer names instead of user IDs
- [ ] All admin-only queries require admin authentication
- [ ] Mobile navigation shows badges correctly

---

## Priority Order

1. **High Priority:**
   - Fix dashboard customer name display (quick fix)
   - Add admin navigation count badges
   - Fix invoice payment flow
   - Add customer detail pages
   - Add deposits metric to analytics

2. **Medium Priority:**
   - Add reviews page to admin

3. **Low Priority:**
   - Additional error handling improvements
