# Test Fixes Plan

## Error Summary

### 1. **Syntax Error - users.test.ts**

- **Error**: "Unexpected end of file" at line 272
- **Cause**: Missing closing brace or incomplete test structure
- **Fix**: Add missing closing brace or complete test structure

### 2. **Invoice Test Errors (3 failures)**

#### a. "list invoices with status filter" & "cannot delete paid invoice"

- **Error**: `Validator error: Unexpected field 'paidDate' in object`
- **Cause**: `invoices.create` mutation doesn't accept `paidDate` in args (it's set automatically when status is "paid")
- **Fix**: Remove `paidDate` from `create` mutation calls in tests. Use `updateStatus` to set paid status instead.

#### b. "update final payment status"

- **Error**: Expected status 'paid' but got 'sent'
- **Cause**: `updateFinalPaymentInternal` only updates `finalPaymentIntentId`, it doesn't update status to "paid"
- **Fix**: Test should call both `updateFinalPaymentInternal` AND `updateStatusInternal` (or update the mutation to handle both)

### 3. **Payment Test Errors (8 failures)**

#### a. STRIPE_SECRET_KEY Environment Variable

- **Error**: `STRIPE_SECRET_KEY environment variable is not set` (fails at module load time)
- **Cause**: `payments.ts` checks for `STRIPE_SECRET_KEY` at module load (line 8-13), before tests can mock it
- **Fix**:
  - Option 1: Move the check inside handlers (better for testing)
  - Option 2: Mock `process.env.STRIPE_SECRET_KEY` before importing the module
  - Option 3: Use Vitest's `vi.stubEnv` to set environment variables

#### b. "create deposit checkout session requires authentication"

- **Error**: Wrong error message (Stripe key error instead of auth error)
- **Cause**: Stripe key check happens before auth check
- **Fix**: After fixing Stripe key issue, this should work correctly

### 4. **Services Test Errors**

#### a. Duplicate Test

- **Error**: Two tests with same name "cannot delete service that is booked"
- **Cause**: One test missing `modules` parameter
- **Fix**: Remove duplicate test or fix the one missing modules

#### b. Scheduled Function Errors

- **Error**: "Write outside of transaction" for scheduled functions
- **Cause**: Scheduled functions (like `createStripeProduct`) try to write outside transaction context
- **Fix**: Use `t.finishInProgressScheduledFunctions()` after mutations that schedule functions, or mock scheduled actions

### 5. **Scheduled Functions in General**

- **Error**: Multiple "Write outside of transaction" errors
- **Cause**: Functions scheduled via `ctx.scheduler.runAfter()` execute asynchronously and try to write outside the test transaction
- **Fix**:
  - Use `t.finishInProgressScheduledFunctions()` to wait for scheduled functions
  - Or disable scheduling in tests by mocking the scheduler
  - Or use fake timers with `vi.useFakeTimers()` and `t.finishAllScheduledFunctions()`

## Implementation Plan

### Phase 1: Quick Fixes (Syntax & Validator Errors)

1. ✅ Fix `users.test.ts` syntax error
2. ✅ Remove `paidDate` from invoice `create` calls in tests
3. ✅ Fix duplicate test in `services.test.ts`
4. ✅ Fix `updateFinalPaymentInternal` test to call both mutations

### Phase 2: Environment Variable Handling

1. ✅ Mock `STRIPE_SECRET_KEY` in payment tests using `vi.stubEnv`
2. ✅ Mock `STRIPE_WEBHOOK_SECRET` for webhook tests
3. ✅ Update payment tests to handle mocked environment

### Phase 3: Scheduled Functions

1. ✅ Add `finishInProgressScheduledFunctions()` calls after mutations that schedule
2. ✅ Or use fake timers for scheduled function tests
3. ✅ Handle scheduled function errors gracefully in tests

### Phase 4: Test Refinements

1. ✅ Update webhook tests to properly mock Stripe responses
2. ✅ Fix authentication test expectations
3. ✅ Ensure all tests use proper module imports

## Files to Modify

1. `convex/users.test.ts` - Fix syntax error
2. `convex/invoices.test.ts` - Remove `paidDate` from create calls, fix final payment test
3. `convex/payments.test.ts` - Mock environment variables, fix webhook tests
4. `convex/services.test.ts` - Remove duplicate test, handle scheduled functions
