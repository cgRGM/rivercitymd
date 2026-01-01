// Vitest setup file for Convex tests
// This file configures the test environment globally

import { vi } from "vitest";

// Set Stripe environment variables globally for all tests
// This ensures scheduled functions have access to the keys
if (typeof process !== "undefined") {
  process.env.STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY || "sk_test_mock_key";
  process.env.STRIPE_WEBHOOK_SECRET =
    process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_mock_secret";
}

// Helper function to create a mock Response with both json() and text() methods
/**
 * Create a mock Response object that mimics fetch responses.
 *
 * @param data - The payload returned by `json()` and serialized by `text()`. When `ok` is `false`, `data` may contain an `error` object whose `message` and `type` are used to populate a Stripe-like error shape.
 * @param options - Optional response options.
 * @param options.ok - Whether the response is successful; defaults to `true`.
 * @param options.status - HTTP status code; defaults to `200`.
 * @returns A mock `Response` object whose `json()` resolves to `data` and whose `text()` resolves to the JSON string of `data`. If `ok` is `false`, `text()` returns a JSON string in a Stripe-like `{ error: { message, type } }` format.
 */
function createMockResponse(
  data: any,
  options: { ok?: boolean; status?: number } = {},
): Response {
  const { ok = true, status = 200 } = options;
  return {
    ok,
    status,
    json: async () => data,
    text: async () => {
      // For error responses, return JSON stringified error (Stripe format)
      if (!ok) {
        return JSON.stringify({
          error: {
            message: data?.error?.message || "Mock error",
            type: data?.error?.type || "api_error",
          },
        });
      }
      // For success responses, return JSON stringified data
      return JSON.stringify(data);
    },
  } as Response;
}

// Mock fetch globally to intercept Stripe API calls from scheduled functions
// This prevents scheduled functions from making real API calls with invalid keys
const originalFetch = globalThis.fetch;
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string | URL, options?: RequestInit) => {
    const urlString = typeof url === "string" ? url : url.toString();

    // Intercept Stripe API calls
    if (urlString.includes("api.stripe.com")) {
      // Parse the endpoint to return appropriate mock responses
      if (urlString.includes("/customers")) {
        // Create or retrieve customer
        return createMockResponse({ id: "cus_test_123" });
      } else if (urlString.includes("/products")) {
        // Create or retrieve product
        return createMockResponse({ id: "prod_test_123" });
      } else if (urlString.includes("/checkout/sessions")) {
        // Create checkout session
        return createMockResponse({
          id: "cs_test_123",
          url: "https://checkout.stripe.com/test",
        });
      } else if (urlString.includes("/payment_intents")) {
        // Create or retrieve payment intent
        return createMockResponse({
          id: "pi_test_123",
          status: "succeeded",
          amount: 1000,
        });
      } else if (urlString.includes("/payment_methods")) {
        // List or create payment methods
        return createMockResponse({
          data: [
            {
              id: "pm_test_123",
              type: "card",
              card: { last4: "4242", brand: "visa" },
            },
          ],
        });
      } else if (urlString.includes("/invoices")) {
        // Create or retrieve invoice
        return createMockResponse({ id: "in_test_123", status: "draft" });
      } else if (urlString.includes("/prices")) {
        // Create or retrieve price
        return createMockResponse({ id: "price_test_123" });
      } else if (urlString.includes("/invoiceitems")) {
        // Create or retrieve invoice item
        return createMockResponse({ id: "ii_test_123" });
      }
      // Default Stripe response
      return createMockResponse({ id: "stripe_test_123" });
    }

    // For non-Stripe URLs, use original fetch if available, otherwise return a basic response
    if (originalFetch) {
      return originalFetch(url, options);
    }
    // Fallback for environments without fetch
    return createMockResponse(
      { error: "Not mocked" },
      { ok: false, status: 404 },
    );
  }),
);

// Extend globalThis to track handled promises
declare global {
  // eslint-disable-next-line no-var
  var __handledTestPromises: Promise<any>[] | undefined;
}

// Glob pattern to import all Convex functions for testing
// Vite's import.meta.glob doesn't support bash extended globbing syntax like !(*.test|*.test.*)
// Instead, we match all .ts/.tsx files and filter out test files from the resulting object
// @ts-expect-error - import.meta.glob is a Vite-specific feature, types may not be available
const allModules = import.meta.glob("./**/*.{ts,tsx}", {
  eager: false,
}) as Record<string, () => Promise<any>>;

// Filter out test files and test setup files
export const modules: Record<string, () => Promise<any>> = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => {
    // Exclude test files and test setup files
    return (
      !path.includes(".test.") &&
      !path.includes(".test/") &&
      !path.endsWith(".test.ts") &&
      !path.endsWith(".test.tsx") &&
      !path.includes("test.setup")
    );
  }),
) as Record<string, () => Promise<any>>;

// Suppress expected unhandled rejections from scheduled functions in tests
// These occur because convex-test tries to update the _scheduled_functions table
// after the test transaction completes, which is expected behavior
if (typeof process !== "undefined" && process.on) {
  // Suppress Node.js warnings about asynchronously handled promise rejections
  // for expected scheduled function errors
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function (warning: any, ...args: any[]) {
    // Suppress PromiseRejectionHandledWarning for expected scheduled function errors
    if (
      typeof warning === "string" &&
      warning.includes("Promise rejection was handled asynchronously")
    ) {
      return;
    }
    // Call original for all other warnings
    if (originalEmitWarning) {
      return (originalEmitWarning as any).apply(process, [warning, ...args]);
    }
  };

  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    // Suppress expected errors from convex-test scheduled function handling
    const errorMessage = reason?.message || String(reason);

    // Check for expected scheduled function errors
    const isScheduledFunctionError =
      (errorMessage.includes("Write outside of transaction") &&
        errorMessage.includes("_scheduled_functions")) ||
      errorMessage.includes(
        "STRIPE_SECRET_KEY environment variable is not set",
      ) ||
      errorMessage.includes("Invalid API Key") ||
      errorMessage.includes("Stripe product creation failed") ||
      errorMessage.includes("Failed to create Stripe customer");

    if (isScheduledFunctionError) {
      // Expected in test environment - convex-test updates scheduled function status
      // after test transactions complete, or Stripe key is missing in test env.
      // This is a framework limitation, not a bug.
      // Handle the rejection by attaching a catch handler that we actually track
      // Store the handled promise to prevent garbage collection
      const handledPromise = promise.catch(() => {
        // Silently ignore - this is expected behavior in tests
      });
      // Keep a reference to the handled promise to ensure it's tracked
      // Use a module-level array to maintain references
      if (!global.__handledTestPromises) {
        global.__handledTestPromises = [];
      }
      global.__handledTestPromises.push(handledPromise);
      // Limit array size to prevent memory leaks (keep last 100)
      if (global.__handledTestPromises.length > 100) {
        global.__handledTestPromises.shift();
      }
      return;
    }
    // For unexpected errors, let them propagate (Vitest will handle them)
  });
}