import { convexTest } from "convex-test";
import { expect, test, describe, vi, beforeEach, beforeAll } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules, stripeFetchMock } from "./test.setup";

describe("payments", () => {
  beforeAll(() => {
    // Mock Stripe environment variables before any imports that check them
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock_secret";
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure env vars are set for each test
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock_secret";
    vi.stubGlobal("fetch", vi.fn(stripeFetchMock));
  });

  // Helper function to create test user with Stripe customer
  async function createTestUser(t: any, withStripeCustomer = false) {
    const userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
        phone: "555-1234",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
        stripeCustomerId: withStripeCustomer ? "cus_test_123" : undefined,
      });
    });
    return userId;
  }

  // Helper function to create test appointment and invoice
  async function createTestAppointmentWithInvoice(
    t: any,
    userId: any,
    adminId: any,
  ) {
    const categoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("serviceCategories", {
        name: "Test Category",
        type: "standard",
      });
    });

    const serviceId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("services", {
        name: "Test Service",
        description: "Test service description",
        basePrice: 100,
        stripePriceIds: [
          "price_test_small",
          "price_test_medium",
          "price_test_large",
        ],
        duration: 60,
        categoryId,
        isActive: true,
      });
    });

    const vehicleId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2020,
        make: "Toyota",
        model: "Camry",
        color: "Blue",
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("depositSettings", {
        amountPerVehicle: 50,
        isActive: true,
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@test.com",
    });
    const { appointmentId, invoiceId } = await asAdmin.mutation(
      api.appointments.create,
      {
        userId,
        vehicleIds: [vehicleId],
        serviceIds: [serviceId],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
    );

    // Wait for scheduled functions to complete (may fail due to Stripe key in test env)
    try {
      await t.finishInProgressScheduledFunctions();
    } catch (error: any) {
      // Ignore Stripe key errors from scheduled functions in tests
      // These are expected since we're not using real Stripe keys
      if (!error?.message?.includes("STRIPE_SECRET_KEY")) {
        throw error;
      }
    }

    return { appointmentId, invoiceId, serviceId };
  }

  test("create deposit checkout session", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    // Mock Stripe API response
    const mockStripeResponse = {
      id: "cs_test_123",
      url: "https://checkout.stripe.com/test",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          json: async () => mockStripeResponse,
        } as Response;
      }),
    );

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });
    const result = await asUser.action(
      api.payments.createDepositCheckoutSession,
      {
        appointmentId,
        invoiceId,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      },
    );

    expect(result.sessionId).toBe("cs_test_123");
    expect(result.url).toBe("https://checkout.stripe.com/test");
  });

  test("create deposit checkout session requires authentication", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    // Try without authentication
    await expect(
      t.action(api.payments.createDepositCheckoutSession, {
        appointmentId,
        invoiceId,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("create deposit checkout session ensures Stripe customer exists", async () => {
    const t = convexTest(schema, modules);
    // Create user without Stripe customer ID
    const userId = await createTestUser(t, false);
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    // Mock ensureStripeCustomer to return a customer ID
    const mockEnsureStripeCustomer = vi.fn(async () => "cus_new_123");

    // Mock Stripe API responses
    let fetchCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetchCallCount++;
        if (url.includes("customers")) {
          // First call: create customer
          return {
            ok: true,
            json: async () => ({ id: "cus_new_123" }),
          } as Response;
        } else if (url.includes("checkout/sessions")) {
          // Second call: create checkout session
          return {
            ok: true,
            json: async () => ({
              id: "cs_test_123",
              url: "https://checkout.stripe.com/test",
            }),
          } as Response;
        }
        return { ok: false } as Response;
      }),
    );

    // Mock the internal action call
    // Note: In a real test, we'd need to mock the internal action differently
    // For now, we'll test that the function handles missing customer ID

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });

    const result = await asUser.action(
      api.payments.createDepositCheckoutSession,
      {
        appointmentId,
        invoiceId,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      },
    );

    expect(result).toEqual({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.com/test",
    });

    const updatedUser = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });
    expect(updatedUser?.stripeCustomerId).toBe(`cus_test_${userId}`);
  });

  test("handle webhook - checkout.session.completed for deposit", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    // Wait for scheduled functions to complete (may fail due to Stripe key, but that's ok)
    try {
      await t.finishInProgressScheduledFunctions();
    } catch (error: any) {
      // Ignore Stripe key errors from scheduled functions in tests
      if (!error?.message?.includes("STRIPE_SECRET_KEY")) {
        throw error;
      }
    }

    // Mock webhook event
    const webhookEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_status: "paid",
          amount_total: 5000, // $50 in cents
          payment_intent: "pi_deposit_test_123", // Payment intent ID from Stripe
          metadata: {
            appointmentId: appointmentId,
            invoiceId: invoiceId,
            type: "deposit",
          },
        },
      },
    };

    // Call webhook handler
    await t.action(api.payments.handleWebhook, {
      body: JSON.stringify(webhookEvent),
      signature: "test_signature",
    });

    // Verify invoice was updated
    const invoice = (await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    })) as any;

    expect(invoice?.depositPaid).toBe(true);
    expect(invoice?.depositPaymentIntentId).toBeDefined();
  });

  test("handle webhook - payment_intent.succeeded for final payment", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    // Wait for scheduled functions to complete (may fail due to Stripe key, but that's ok)
    try {
      await t.finishInProgressScheduledFunctions();
    } catch (error: any) {
      // Ignore Stripe key errors from scheduled functions in tests
      if (!error?.message?.includes("STRIPE_SECRET_KEY")) {
        throw error;
      }
    }

    // Set deposit as paid first
    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_123",
    });

    // Mock webhook event for final payment
    const webhookEvent = {
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_final_123",
          amount: 5000, // $50 in cents (remaining balance)
          metadata: {
            appointmentId: appointmentId,
            invoiceId: invoiceId,
            type: "final_payment",
          },
        },
      },
    };

    // Call webhook handler
    await t.action(api.payments.handleWebhook, {
      body: JSON.stringify(webhookEvent),
      signature: "test_signature",
    });

    // Verify invoice was updated
    const invoice = (await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    })) as any;

    expect(invoice?.finalPaymentIntentId).toBe("pi_final_123");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidDate).toBeDefined();

    // Verify user stats were updated
    const user = (await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    })) as any;
    expect(user?.timesServiced).toBeGreaterThan(0);
    expect(user?.totalSpent).toBeGreaterThan(0);
  });

  test("handle webhook - invalid event type", async () => {
    const t = convexTest(schema, modules);

    const webhookEvent = {
      type: "unknown.event.type",
      data: {
        object: {},
      },
    };

    // Should not throw, just ignore unknown event types
    await t.action(api.payments.handleWebhook, {
      body: JSON.stringify(webhookEvent),
      signature: "test_signature",
    });
  });

  test("get payment methods", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);

    // Add a payment method
    await t.run(async (ctx: any) => {
      await ctx.db.insert("paymentMethods", {
        userId,
        stripePaymentMethodId: "pm_test_123",
        type: "card",
        last4: "4242",
        brand: "visa",
        isDefault: true,
        createdAt: new Date().toISOString(),
      });
    });

    // Mock Stripe API response
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: "pm_test_123",
                type: "card",
                card: { last4: "4242", brand: "visa" },
              },
            ],
          }),
        } as Response;
      }),
    );

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });
    const paymentMethods = await asUser.query(api.payments.getPaymentMethods, {
      userId,
    });

    expect(paymentMethods.length).toBeGreaterThan(0);
    expect(paymentMethods[0]).toMatchObject({
      last4: "4242",
      brand: "visa",
    });
  });

  test("create payment intent", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    // Mock Stripe API response
    const mockPaymentIntent = {
      id: "pi_test_123",
      amount: 5000,
      currency: "usd",
      status: "requires_payment_method",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          json: async () => mockPaymentIntent,
        } as Response;
      }),
    );

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });
    const result = await asUser.action(api.payments.createPaymentIntent, {
      amount: 50,
      currency: "usd",
      customerId: "cus_test_123",
      invoiceId,
      paymentType: "deposit",
    });

    expect(result.id).toBe("pi_test_123");
    expect(result.amount).toBe(5000);
  });

  test("createStripeInvoiceAfterDeposit uses invoice items even when service Stripe price IDs are missing", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId, serviceId } =
      await createTestAppointmentWithInvoice(t, userId, adminId);

    await t.run(async (ctx: any) => {
      await ctx.db.patch(serviceId, { stripePriceIds: [] });
    });
    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_test_123",
      status: "draft",
    });

    const invoiceItemBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        const body =
          options?.body instanceof URLSearchParams
            ? options.body.toString()
            : typeof options?.body === "string"
              ? options.body
              : "";

        if (urlString.includes("/customers/")) {
          return {
            ok: true,
            json: async () => ({
              id: "cus_test_123",
              invoice_settings: { default_payment_method: undefined },
            }),
          } as Response;
        }

        if (urlString.includes("/invoiceitems")) {
          invoiceItemBodies.push(body);
          return {
            ok: true,
            json: async () => ({ id: `ii_${invoiceItemBodies.length}` }),
          } as Response;
        }

        if (
          urlString.endsWith("/invoices") &&
          options?.method === "POST"
        ) {
          return {
            ok: true,
            json: async () => ({ id: "in_backfill_123", status: "draft" }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_backfill_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_backfill_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_backfill_123/send")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_backfill_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_backfill_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_backfill_123",
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ id: "stripe_test_123" }),
        } as Response;
      }),
    );

    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousConvexTest = env.CONVEX_TEST;
    env.NODE_ENV = "development";
    env.CONVEX_TEST = "false";

    try {
      await t.action(internal.payments.createStripeInvoiceAfterDeposit, {
        invoiceId,
        appointmentId,
      });
    } finally {
      env.NODE_ENV = previousNodeEnv;
      env.CONVEX_TEST = previousConvexTest;
    }

    expect(invoiceItemBodies.length).toBeGreaterThan(0);
    // Price IDs are intentionally missing in the service, so invoice item creation
    // must use amount-based line items from invoice.items.
    expect(invoiceItemBodies.some((body) => body.includes("price="))).toBe(
      false,
    );
    expect(invoiceItemBodies.some((body) => body.includes("amount="))).toBe(
      true,
    );

    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.stripeInvoiceId).toBe("in_backfill_123");
    expect(invoice?.stripeInvoiceUrl).toBe(
      "https://stripe.test/invoices/in_backfill_123",
    );
  });

  test("createStripeInvoiceAfterDeposit does not send invoice for charge_automatically", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_test_123",
      status: "draft",
    });

    const calledUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        calledUrls.push(urlString);

        if (urlString.includes("/customers/")) {
          return {
            ok: true,
            json: async () => ({
              id: "cus_test_123",
              invoice_settings: { default_payment_method: "pm_test_123" },
            }),
          } as Response;
        }

        if (urlString.includes("/invoiceitems")) {
          return { ok: true, json: async () => ({ id: "ii_test_123" }) } as Response;
        }

        if (urlString.endsWith("/invoices") && options?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ id: "in_auto_123", status: "draft" }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_auto_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_auto_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_auto_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_auto_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_auto_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_auto_123",
            }),
          } as Response;
        }

        return { ok: true, json: async () => ({ id: "stripe_test_123" }) } as Response;
      }),
    );

    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousConvexTest = env.CONVEX_TEST;
    env.NODE_ENV = "development";
    env.CONVEX_TEST = "false";

    try {
      await t.action(internal.payments.createStripeInvoiceAfterDeposit, {
        invoiceId,
        appointmentId,
      });
    } finally {
      env.NODE_ENV = previousNodeEnv;
      env.CONVEX_TEST = previousConvexTest;
    }

    expect(calledUrls.some((url) => url.includes("/invoices/in_auto_123/send"))).toBe(
      false,
    );
  });

  test("createStripeInvoiceAfterDeposit sends invoice for send_invoice collection", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointmentWithInvoice(
      t,
      userId,
      adminId,
    );

    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_test_123",
      status: "draft",
    });

    const calledUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        calledUrls.push(urlString);

        if (urlString.includes("/customers/")) {
          return {
            ok: true,
            json: async () => ({
              id: "cus_test_123",
              invoice_settings: { default_payment_method: undefined },
            }),
          } as Response;
        }

        if (urlString.includes("/invoiceitems")) {
          return { ok: true, json: async () => ({ id: "ii_test_123" }) } as Response;
        }

        if (urlString.endsWith("/invoices") && options?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ id: "in_manual_123", status: "draft" }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_manual_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_manual_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_manual_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_manual_123/send")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_manual_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_manual_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_manual_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_manual_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_manual_123",
            }),
          } as Response;
        }

        return { ok: true, json: async () => ({ id: "stripe_test_123" }) } as Response;
      }),
    );

    await t.action(internal.payments.createStripeInvoiceAfterDeposit, {
      invoiceId,
      appointmentId,
    });

    expect(calledUrls.some((url) => url.includes("/invoices/in_manual_123/send"))).toBe(
      true,
    );
  });

  test("syncPaymentStatus does not infer final payment from remaining-balance payment intent search", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { invoiceId } = await createTestAppointmentWithInvoice(t, userId, adminId);
    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_123",
      status: "sent",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (urlString.includes("/payment_intents/pi_deposit_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "pi_deposit_123",
              status: "succeeded",
              amount: 5000,
            }),
          } as Response;
        }

        // Old logic used to scan payment intents by customer + amount and mark paid.
        // Keep a matching PI available to ensure new logic ignores it.
        if (urlString.includes("/payment_intents?customer=")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: "pi_false_match_123",
                  status: "succeeded",
                  amount: 5000,
                  created: Math.floor(Date.now() / 1000),
                },
              ],
            }),
          } as Response;
        }

        return { ok: true, json: async () => ({ id: "stripe_test_123" }) } as Response;
      }),
    );

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });
    const result = await asUser.action(api.payments.syncPaymentStatus, {
      invoiceId,
    });

    expect(result.updated).toBe(false);
    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.status).not.toBe("paid");
    expect(invoice?.finalPaymentIntentId).toBeUndefined();
  });

  test("backfillMissingStripeInvoices dry-run reports candidates without mutation", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { invoiceId } = await createTestAppointmentWithInvoice(t, userId, adminId);
    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_123",
      status: "draft",
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@test.com",
    });
    const result = await asAdmin.action(api.payments.backfillMissingStripeInvoices, {
      dryRun: true,
      limit: 10,
    });

    expect(result.candidates).toBeGreaterThan(0);
    expect(result.skipped).toBe(result.candidates);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);

    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.stripeInvoiceId).toBeUndefined();
  });

  test("backfillMissingStripeInvoices repairs false paid state and creates Stripe invoice", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);
    const adminId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { invoiceId } = await createTestAppointmentWithInvoice(t, userId, adminId);
    await t.run(async (ctx: any) => {
      await ctx.db.patch(invoiceId, {
        depositPaid: true,
        depositPaymentIntentId: "pi_deposit_123",
        finalPaymentIntentId: "pi_deposit_123",
        status: "paid",
        paidDate: "2026-02-13",
      });
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (urlString.includes("/customers/")) {
          return {
            ok: true,
            json: async () => ({
              id: "cus_test_123",
              invoice_settings: { default_payment_method: undefined },
            }),
          } as Response;
        }
        if (urlString.includes("/invoiceitems")) {
          return { ok: true, json: async () => ({ id: "ii_test_123" }) } as Response;
        }
        if (urlString.endsWith("/invoices") && options?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ id: "in_backfill_exec_123", status: "draft" }),
          } as Response;
        }
        if (urlString.includes("/invoices/in_backfill_exec_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_exec_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_backfill_exec_123",
            }),
          } as Response;
        }
        if (urlString.includes("/invoices/in_backfill_exec_123/send")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_exec_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_backfill_exec_123",
            }),
          } as Response;
        }
        if (urlString.includes("/invoices/in_backfill_exec_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_exec_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_backfill_exec_123",
            }),
          } as Response;
        }

        return { ok: true, json: async () => ({ id: "stripe_test_123" }) } as Response;
      }),
    );

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@test.com",
    });
    const result = await asAdmin.action(api.payments.backfillMissingStripeInvoices, {
      dryRun: false,
      limit: 10,
    });

    expect(result.patched).toBeGreaterThanOrEqual(1);
    expect(result.succeeded).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.status).toBe("sent");
    expect(invoice?.finalPaymentIntentId).toBeUndefined();
    expect(invoice?.stripeInvoiceId).toBe("in_backfill_exec_123");
    expect(invoice?.stripeInvoiceUrl).toBe(
      "https://stripe.test/invoices/in_backfill_exec_123",
    );
  });
});
