# Testing Plan for River City Mobile Detailing

## Current State

### Existing Tests

- ✅ `appointments.test.ts` - Basic appointment creation, listing, status updates
- ⚠️ `services.test.ts` - Partial tests (some empty test cases)
- ⚠️ `users.test.ts` - Partial tests (some empty test cases)

### Missing Critical Tests

- ❌ `payments.test.ts` - **CRITICAL**: No tests for payment processing
- ❌ `invoices.test.ts` - **CRITICAL**: No tests for invoice management
- ❌ `depositSettings.test.ts` - No tests for deposit configuration
- ❌ `reviews.test.ts` - No tests for review system
- ❌ `analytics.test.ts` - No tests for analytics queries

## Testing Strategy

### Priority 1: Critical Business Logic (Payment & Invoicing)

These are the most critical paths that handle money and must be thoroughly tested.

#### `payments.test.ts`

- [ ] `createDepositCheckoutSession` - Create checkout for deposit payment
- [ ] `createRemainingBalanceCheckoutSession` - Create checkout for final payment
- [ ] `createCheckoutSession` - Generic checkout session creation
- [ ] `handleWebhook` - Webhook event processing (mocked Stripe events)
  - [ ] `checkout.session.completed` - Deposit payment success
  - [ ] `payment_intent.succeeded` - Final payment success
  - [ ] Error handling for invalid webhooks
- [ ] `createPaymentIntent` - Payment intent creation (mocked)
- [ ] `confirmPaymentIntent` - Payment confirmation (mocked)
- [ ] `getPaymentMethods` - List user payment methods
- [ ] `addPaymentMethod` - Add new payment method
- [ ] `deletePaymentMethod` - Remove payment method

#### `invoices.test.ts`

- [ ] `create` - Invoice creation
- [ ] `list` - List invoices with status filtering
- [ ] `getById` - Get single invoice
- [ ] `getByAppointment` - Get invoice by appointment
- [ ] `updateStatus` - Update invoice status (draft → sent → paid)
- [ ] `updateDepositStatus` - Mark deposit as paid
- [ ] `updateFinalPayment` - Mark final payment as paid
- [ ] `updateStripeInvoiceData` - Update Stripe-related fields
- [ ] `deleteInvoice` - Delete invoice (with validation)

### Priority 2: Core Business Operations

#### `appointments.test.ts` (Expand existing)

- [ ] `create` - Already tested, add edge cases
- [ ] `list` - Already tested, add more filters
- [ ] `updateStatus` - Already tested, add state transitions
- [ ] `getByUser` - Get user's appointments
- [ ] `chargeFinalPayment` - Charge remaining balance
- [ ] `generateAndSendInvoice` - Invoice generation
- [ ] `cancel` - Cancel appointment
- [ ] `reschedule` - Reschedule appointment
- [ ] Authorization tests (users can only see their own)

#### `users.test.ts` (Complete empty tests)

- [ ] `createUserWithAppointment` - User creation during booking
- [ ] `getCurrentUser` - Already tested
- [ ] `getOnboardingStatus` - Already tested
- [ ] `addVehicle` - Already tested
- [ ] `removeVehicle` - Already tested
- [ ] `create` - Admin user creation
- [ ] `list` - Admin user listing
- [ ] `getById` - Get user by ID
- [ ] `ensureStripeCustomer` - Stripe customer creation
- [ ] `updateProfile` - Update user profile

#### `services.test.ts` (Complete empty tests)

- [ ] `create` - Service creation
- [ ] `list` - Service listing
- [ ] `update` - Already tested
- [ ] `deleteService` - Already tested
- [ ] `createCategory` - Category creation
- [ ] `listCategories` - Category listing

### Priority 3: Supporting Features

#### `depositSettings.test.ts` (New)

- [ ] `get` - Get deposit settings
- [ ] `update` - Update deposit amount
- [ ] `setActive` - Enable/disable deposits

#### `reviews.test.ts` (New)

- [ ] `create` - Create review
- [ ] `list` - List reviews
- [ ] `getByAppointment` - Get review for appointment
- [ ] `getPublic` - Get public reviews

#### `analytics.test.ts` (New)

- [ ] `getRevenue` - Revenue calculations
- [ ] `getAppointmentStats` - Appointment statistics
- [ ] `getCustomerStats` - Customer analytics

## Test Setup Requirements

### Mocking Strategy

1. **Stripe API**: Mock all `fetch` calls to Stripe API
   - Use `vi.stubGlobal("fetch", ...)` to mock Stripe responses
   - Test both success and error scenarios
2. **Webhooks**: Mock webhook event payloads
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `invoice.payment_succeeded`

3. **Authentication**: Use `t.withIdentity()` for authenticated tests

### Test Data Setup

Create helper functions for common test data:

- `createTestUser()` - Create user with required fields
- `createTestService()` - Create service with category
- `createTestAppointment()` - Create appointment with dependencies
- `createTestInvoice()` - Create invoice with appointment

### Test Coverage Goals

- **Critical paths**: 90%+ coverage (payments, invoices, appointments)
- **Core features**: 80%+ coverage (users, services)
- **Supporting features**: 70%+ coverage (reviews, analytics)

## Implementation Order

1. ✅ **Setup test infrastructure** (vitest.config.mts already exists)
2. 🔄 **Create payment tests** (`payments.test.ts`) - **START HERE**
3. 🔄 **Create invoice tests** (`invoices.test.ts`)
4. 🔄 **Expand appointment tests** (add missing cases)
5. 🔄 **Complete user tests** (fill empty test cases)
6. 🔄 **Complete service tests** (fill empty test cases)
7. ⏳ **Add deposit settings tests**
8. ⏳ **Add review tests**
9. ⏳ **Add analytics tests**

## Notes

- Use `convexTest(schema, modules)` with proper module globbing
- Mock Stripe API calls using Vitest's `vi.stubGlobal`
- Test both success and error paths
- Test authorization (admin vs client access)
- Test data validation and edge cases
- Use `t.run()` for direct database operations when needed
- Use `t.withIdentity()` for authenticated function calls
