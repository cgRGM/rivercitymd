import { convexTest } from "convex-test";
import { expect, test, describe, vi, beforeEach, beforeAll } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules, stripeFetchMock } from "./test.setup";
import { seedBookingSetup } from "./testUtils/bookingSetup";

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
    await t.run(async (ctx: any) => {
      await ctx.db.patch(userId, { clerkUserId: userId });
    });
    return userId;
  }

  // Helper function to create test appointment and invoice
  async function createTestAppointmentWithInvoice(
    t: any,
    userId: any,
    adminId: any,
  ) {
    await seedBookingSetup(t, {
      includeBookableService: false,
      includeDepositSettings: true,
    });

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

  test("guest booking flow creates user/appointment/invoice and returns checkout URL", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t, {
      includeBookableService: false,
      includeDepositSettings: false,
    });

    const serviceId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("services", {
        name: "Guest Flow Service",
        description: "Guest booking service",
        basePrice: 120,
        basePriceMedium: 120,
        duration: 60,
        serviceType: "standard",
        isActive: true,
      });
    });

    const booking = await t.mutation(api.users.createUserWithAppointment, {
      name: "Guest Booker",
      email: "guest-booker@example.com",
      phone: "555-3030",
      address: {
        street: "123 Guest St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
      vehicles: [
        {
          year: 2021,
          make: "Honda",
          model: "Civic",
          size: "medium",
          color: "Black",
        },
      ],
      serviceIds: [serviceId],
      scheduledDate: "2024-12-02",
      scheduledTime: "10:00",
    });

    const appointment = await t.run(async (ctx: any) => {
      return await ctx.db.get(booking.appointmentId);
    });
    const invoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(booking.invoiceId);
    });
    expect(appointment?._id).toBe(booking.appointmentId);
    expect(invoice?._id).toBe(booking.invoiceId);

    const successUrl =
      "https://example.com/sign-up?after=booking&redirect=%2Fdashboard%2Fappointments";
    const cancelUrl = "https://example.com/booking/cancel";

    let checkoutRequestBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (urlString.includes("checkout/sessions")) {
          if (options?.body instanceof URLSearchParams) {
            checkoutRequestBody = options.body.toString();
          } else if (typeof options?.body === "string") {
            checkoutRequestBody = options.body;
          }
          return {
            ok: true,
            json: async () => ({
              id: "cs_guest_123",
              url: "https://checkout.stripe.com/guest",
            }),
          } as Response;
        }
        return stripeFetchMock(url, options);
      }),
    );

    const checkout = await t.action(api.payments.createBookingCheckout, {
      appointmentId: booking.appointmentId,
      invoiceId: booking.invoiceId,
      successUrl,
      cancelUrl,
      name: "Guest Booker",
      email: "guest-booker@example.com",
      phone: "555-3030",
    });

    expect(checkout.sessionId).toBe("cs_guest_123");
    expect(checkout.url).toBe("https://checkout.stripe.com/guest");

    const bodyParams = new URLSearchParams(checkoutRequestBody);
    expect(bodyParams.get("success_url")).toBe(
      "https://example.com/sign-up?after=booking&redirect=%2Fdashboard%2Fappointments",
    );
    expect(bodyParams.get("cancel_url")).toBe(cancelUrl);
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

  test("handle webhook - payment_intent.succeeded is idempotent for duplicate final payment events", async () => {
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

    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_123",
    });

    const webhookEvent = {
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_final_duplicate_123",
          amount: 5000,
          metadata: {
            appointmentId,
            invoiceId,
            type: "final_payment",
          },
        },
      },
    };

    await t.action(api.payments.handleWebhook, {
      body: JSON.stringify(webhookEvent),
      signature: "test_signature",
    });
    await t.action(api.payments.handleWebhook, {
      body: JSON.stringify(webhookEvent),
      signature: "test_signature",
    });

    const [invoice, user] = await Promise.all([
      t.run(async (ctx: any) => ctx.db.get(invoiceId)),
      t.run(async (ctx: any) => ctx.db.get(userId)),
    ]);

    expect((invoice as any)?.status).toBe("paid");
    expect((invoice as any)?.finalPaymentIntentId).toBe("pi_final_duplicate_123");
    expect((user as any)?.timesServiced).toBe(1);
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

  test("add payment method action creates record and sets default", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (urlString.includes("/payment_methods/pm_new_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "pm_new_123",
              type: "card",
              card: { last4: "4242", brand: "visa" },
            }),
          } as Response;
        }
        return stripeFetchMock(url, options);
      }),
    );

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });

    const createdId = await asUser.action(api.payments.addPaymentMethod, {
      paymentMethodId: "pm_new_123",
    });

    const stored = await t.run(async (ctx: any) => {
      return await ctx.db.get(createdId);
    });

    expect(stored?.stripePaymentMethodId).toBe("pm_new_123");
    expect(stored?.isDefault).toBe(true);
    expect(stored?.last4).toBe("4242");
  });

  test("add payment method action rejects duplicates", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("paymentMethods", {
        userId,
        stripePaymentMethodId: "pm_dup_123",
        type: "card",
        last4: "4242",
        brand: "visa",
        isDefault: true,
        createdAt: new Date().toISOString(),
      });
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (urlString.includes("/payment_methods/pm_dup_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "pm_dup_123",
              type: "card",
              card: { last4: "4242", brand: "visa" },
            }),
          } as Response;
        }
        return stripeFetchMock(url, options);
      }),
    );

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });

    await expect(
      asUser.action(api.payments.addPaymentMethod, {
        paymentMethodId: "pm_dup_123",
      }),
    ).rejects.toThrow("Payment method already exists");
  });

  test("delete payment method action detaches from Stripe and removes db row", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t, true);

    const paymentMethodId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("paymentMethods", {
        userId,
        stripePaymentMethodId: "pm_delete_123",
        type: "card",
        last4: "4242",
        brand: "visa",
        isDefault: true,
        createdAt: new Date().toISOString(),
      });
    });

    const detachCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (
          urlString.includes("/payment_methods/pm_delete_123/detach") &&
          options?.method === "POST"
        ) {
          detachCalls.push(urlString);
          return { ok: true, json: async () => ({ id: "pm_delete_123" }) } as Response;
        }
        return stripeFetchMock(url, options);
      }),
    );

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });

    await asUser.action(api.payments.deletePaymentMethod, {
      paymentMethodId,
    });

    const deleted = await t.run(async (ctx: any) => {
      return await ctx.db.get(paymentMethodId);
    });

    expect(detachCalls.length).toBe(1);
    expect(deleted).toBeNull();
  });

  test("delete payment method action enforces ownership", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createTestUser(t, true);
    const otherUserId = await createTestUser(t, true);

    const paymentMethodId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("paymentMethods", {
        userId: ownerId,
        stripePaymentMethodId: "pm_owner_only_123",
        type: "card",
        last4: "4242",
        brand: "visa",
        isDefault: true,
        createdAt: new Date().toISOString(),
      });
    });

    const asOtherUser = t.withIdentity({
      subject: otherUserId,
      email: "other@test.com",
    });

    await expect(
      asOtherUser.action(api.payments.deletePaymentMethod, {
        paymentMethodId,
      }),
    ).rejects.toThrow("Payment method not found");
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
    const invoiceBodies: string[] = [];
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
          invoiceBodies.push(body);
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
    expect(invoiceItemBodies.some((body) => body.includes("quantity="))).toBe(
      false,
    );
    expect(invoiceBodies.some((body) => body.includes("due_date="))).toBe(true);
    expect(invoiceBodies.some((body) => body.includes("days_until_due="))).toBe(
      false,
    );

    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.stripeInvoiceId).toBe("in_backfill_123");
    expect(invoice?.stripeInvoiceUrl).toBe(
      "https://stripe.test/invoices/in_backfill_123",
    );
  });

  test("createStripeInvoiceAfterDeposit skips send for charge_automatically collection", async () => {
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
    await t.run(async (ctx: any) => {
      await ctx.db.patch(invoiceId, {
        remainingBalanceCollectionMethod: "charge_automatically",
      });
    });

    const calledUrls: string[] = [];
    const invoiceBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        calledUrls.push(urlString);
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
              invoice_settings: { default_payment_method: "pm_test_123" },
            }),
          } as Response;
        }

        if (urlString.includes("/invoiceitems")) {
          return { ok: true, json: async () => ({ id: "ii_test_123" }) } as Response;
        }

        if (urlString.endsWith("/invoices") && options?.method === "POST") {
          invoiceBodies.push(body);
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

    await t.action(internal.payments.createStripeInvoiceAfterDeposit, {
      invoiceId,
      appointmentId,
    });

    expect(
      calledUrls.some((url) => url.includes("/invoices/in_auto_123/send")),
    ).toBe(false);
    expect(
      invoiceBodies.some((body) =>
        body.includes("collection_method=charge_automatically"),
      ),
    ).toBe(true);
    expect(invoiceBodies.some((body) => body.includes("due_date="))).toBe(
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
    const invoiceBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        calledUrls.push(urlString);
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
          return { ok: true, json: async () => ({ id: "ii_test_123" }) } as Response;
        }

        if (urlString.endsWith("/invoices") && options?.method === "POST") {
          invoiceBodies.push(body);
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
    expect(
      invoiceBodies.some((body) =>
        body.includes("collection_method=send_invoice"),
      ),
    ).toBe(true);
    expect(invoiceBodies.some((body) => body.includes("due_date="))).toBe(true);
    expect(invoiceBodies.some((body) => body.includes("days_until_due="))).toBe(
      false,
    );
  });

  test("createStripeInvoiceAfterDeposit persists Stripe linkage even when send fails", async () => {
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
              email: "test@example.com",
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
            json: async () => ({ id: "in_send_fail_123", status: "draft" }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_send_fail_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_send_fail_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_send_fail_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_send_fail_123/send")) {
          return {
            ok: false,
            text: async () => "send failed",
          } as Response;
        }

        if (urlString.includes("/invoices/in_send_fail_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_send_fail_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_send_fail_123",
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

    expect(
      calledUrls.some((url) => url.includes("/invoices/in_send_fail_123/send")),
    ).toBe(true);
    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.stripeInvoiceId).toBe("in_send_fail_123");
    expect(invoice?.stripeInvoiceUrl).toBe(
      "https://stripe.test/invoices/in_send_fail_123",
    );
    expect(invoice?.status).toBe("sent");
  });

  test("createStripeInvoiceAfterDeposit is idempotent when Stripe linkage already exists", async () => {
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

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();

        if (urlString.includes("/customers/")) {
          return {
            ok: true,
            json: async () => ({
              id: "cus_test_123",
              email: "test@example.com",
            }),
          } as Response;
        }

        if (urlString.includes("/invoiceitems")) {
          return { ok: true, json: async () => ({ id: "ii_test_123" }) } as Response;
        }

        if (urlString.endsWith("/invoices") && options?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ id: "in_idempotent_123", status: "draft" }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_idempotent_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_idempotent_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_idempotent_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_idempotent_123/send")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_idempotent_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_idempotent_123",
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

    const secondCallFetch = vi.fn(async () => {
      throw new Error("Idempotent second call should not hit Stripe");
    });
    vi.stubGlobal("fetch", secondCallFetch as any);

    const secondResult = await t.action(
      internal.payments.createStripeInvoiceAfterDeposit,
      {
        invoiceId,
        appointmentId,
      },
    );

    expect(secondResult.stripeInvoiceId).toBe("in_idempotent_123");
    expect(secondResult.stripeInvoiceUrl).toBe(
      "https://stripe.test/invoices/in_idempotent_123",
    );
    expect(secondCallFetch).not.toHaveBeenCalled();
  });

  test("reissueStripeInvoice voids the existing unpaid invoice and recreates it with updated billing settings", async () => {
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

    await t.run(async (ctx: any) => {
      await ctx.db.patch(invoiceId, {
        depositPaid: true,
        depositPaymentIntentId: "pi_deposit_test_123",
        status: "sent",
        stripeInvoiceId: "in_old_123",
        stripeInvoiceUrl: "https://stripe.test/invoices/in_old_123",
        remainingBalanceCollectionMethod: "send_invoice",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@test.com",
    });
    await asAdmin.mutation(api.invoices.updateBillingSettings, {
      invoiceId,
      dueDate: "2024-12-20",
      remainingBalanceCollectionMethod: "charge_automatically",
    });

    const calledUrls: string[] = [];
    const invoiceBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = typeof url === "string" ? url : url.toString();
        calledUrls.push(urlString);
        const body =
          options?.body instanceof URLSearchParams
            ? options.body.toString()
            : typeof options?.body === "string"
              ? options.body
              : "";

        if (urlString.includes("/customers/")) {
          return {
            ok: true,
            json: async () => ({ id: "cus_test_123" }),
          } as Response;
        }

        if (urlString.endsWith("/invoices/in_old_123") && options?.method === "GET") {
          return {
            ok: true,
            json: async () => ({
              id: "in_old_123",
              status: "open",
              hosted_invoice_url: "https://stripe.test/invoices/in_old_123",
            }),
          } as Response;
        }

        if (urlString.endsWith("/invoices/in_old_123/void")) {
          return {
            ok: true,
            json: async () => ({ id: "in_old_123", status: "void" }),
          } as Response;
        }

        if (urlString.includes("/invoiceitems")) {
          return { ok: true, json: async () => ({ id: "ii_test_123" }) } as Response;
        }

        if (urlString.endsWith("/invoices") && options?.method === "POST") {
          invoiceBodies.push(body);
          return {
            ok: true,
            json: async () => ({ id: "in_reissued_123", status: "draft" }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_reissued_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_reissued_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_reissued_123",
            }),
          } as Response;
        }

        if (urlString.includes("/invoices/in_reissued_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_reissued_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_reissued_123",
            }),
          } as Response;
        }

        return { ok: true, json: async () => ({ id: "stripe_test_123" }) } as Response;
      }),
    );

    const result = await asAdmin.action(api.payments.reissueStripeInvoice, {
      invoiceId,
    });

    expect(result.stripeInvoiceId).toBe("in_reissued_123");
    expect(calledUrls.some((url) => url.includes("/invoices/in_old_123/void"))).toBe(
      true,
    );
    expect(
      calledUrls.some((url) => url.includes("/invoices/in_reissued_123/send")),
    ).toBe(false);
    expect(
      invoiceBodies.some((body) =>
        body.includes("collection_method=charge_automatically"),
      ),
    ).toBe(true);

    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.stripeInvoiceId).toBe("in_reissued_123");
    expect(invoice?.remainingBalanceCollectionMethod).toBe(
      "charge_automatically",
    );
    expect(invoice?.dueDate).toBe("2024-12-20");
  });

  test("reissueStripeInvoice rejects paid invoices", async () => {
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
        depositPaymentIntentId: "pi_deposit_test_123",
        status: "paid",
        paidDate: "2024-12-02",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@test.com",
    });

    await expect(
      asAdmin.action(api.payments.reissueStripeInvoice, {
        invoiceId,
      }),
    ).rejects.toThrow("Paid invoices cannot be reissued");
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

  test("syncPaymentStatus allows admins to sync a customer's invoice", async () => {
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
        depositPaid: false,
        depositPaymentIntentId: "pi_admin_sync_123",
        status: "sent",
      });
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (urlString.includes("/payment_intents/pi_admin_sync_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "pi_admin_sync_123",
              status: "succeeded",
              amount: 5000,
            }),
          } as Response;
        }

        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }),
    );

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@test.com",
    });
    const result = await asAdmin.action(api.payments.syncPaymentStatus, {
      invoiceId,
    });

    expect(result.updated).toBe(true);
    const invoice = await t.run(async (ctx: any) => ctx.db.get(invoiceId));
    expect(invoice?.depositPaid).toBe(true);
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

  test("backfillMissingStripeInvoices dry-run includes paid invoices missing final payment evidence", async () => {
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
        finalPaymentIntentId: undefined,
        stripeInvoiceId: undefined,
        stripeInvoiceUrl: undefined,
        status: "paid",
        paidDate: "2026-02-13",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@test.com",
    });
    const result = await asAdmin.action(api.payments.backfillMissingStripeInvoices, {
      dryRun: true,
      limit: 10,
    });

    expect(result.candidates).toBeGreaterThanOrEqual(1);
    expect(result.skipped).toBe(result.candidates);
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

  test("backfillMissingStripeInvoices repairs paid invoice without final evidence", async () => {
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
        depositPaymentIntentId: "pi_deposit_789",
        finalPaymentIntentId: undefined,
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
              email: "test@example.com",
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
            json: async () => ({
              id: "in_backfill_missing_final_123",
              status: "draft",
            }),
          } as Response;
        }
        if (urlString.includes("/invoices/in_backfill_missing_final_123/finalize")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_missing_final_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_backfill_missing_final_123",
            }),
          } as Response;
        }
        if (urlString.includes("/invoices/in_backfill_missing_final_123/send")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_missing_final_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_backfill_missing_final_123",
            }),
          } as Response;
        }
        if (urlString.includes("/invoices/in_backfill_missing_final_123")) {
          return {
            ok: true,
            json: async () => ({
              id: "in_backfill_missing_final_123",
              status: "open",
              hosted_invoice_url:
                "https://stripe.test/invoices/in_backfill_missing_final_123",
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
    expect(invoice?.stripeInvoiceId).toBe("in_backfill_missing_final_123");
    expect(invoice?.stripeInvoiceUrl).toBe(
      "https://stripe.test/invoices/in_backfill_missing_final_123",
    );
  });
});
