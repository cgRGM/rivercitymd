import { action, internalAction, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity, isAdmin } from "./auth";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { stripeClient } from "./stripeClient";

// Helper function to get Stripe secret key from environment
function getStripeSecretKey(): string {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is not set. Please set it in your Convex environment.",
    );
  }
  return stripeSecretKey;
}

// Helper function to make Stripe API calls
async function stripeApiCall(endpoint: string, options: RequestInit = {}) {
  const stripeSecretKey = getStripeSecretKey();
  const url = `https://api.stripe.com/v1/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stripe API error: ${response.status} ${error}`);
  }

  return response.json();
}

const backfillSummaryValidator = v.object({
  scanned: v.number(),
  candidates: v.number(),
  patched: v.number(),
  succeeded: v.number(),
  failed: v.number(),
  skipped: v.number(),
  errors: v.array(v.string()),
});

type BackfillSummary = {
  scanned: number;
  candidates: number;
  patched: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
};

function appendMetadata(
  params: URLSearchParams,
  metadata: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(metadata)) {
    params.append(`metadata[${key}]`, value);
  }
}

async function createStripeInvoiceAfterDepositImpl(
  ctx: any,
  args: {
    invoiceId: Id<"invoices">;
    appointmentId: Id<"appointments">;
  },
): Promise<{
  stripeInvoiceId: string;
  stripeInvoiceUrl: string;
}> {
  // Validate Stripe configuration early; throws if missing
  getStripeSecretKey();

  const invoice = await ctx.runQuery(internal.invoices.getByIdInternal, {
    invoiceId: args.invoiceId,
  });
  const appointment = await ctx.runQuery(internal.appointments.getByIdInternal, {
    appointmentId: args.appointmentId,
  });

  if (!invoice || !appointment) {
    throw new Error("Invoice or appointment not found");
  }

  const user = await ctx.runQuery(internal.users.getByIdInternal, {
    userId: appointment.userId,
  });
  if (!user) {
    throw new Error("User not found");
  }

  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    stripeCustomerId = await ctx.runAction(internal.users.ensureStripeCustomer, {
      userId: appointment.userId,
    });
  }

  console.log(
    `[payments] createStripeInvoiceAfterDeposit:start invoiceId=${args.invoiceId} appointmentId=${args.appointmentId}`,
  );

  let hasDefaultPaymentMethod = false;
  if (process.env.CONVEX_TEST !== "true" && process.env.NODE_ENV !== "test") {
    try {
      const customer = await stripeApiCall(`customers/${stripeCustomerId}`, {
        method: "GET",
      });
      hasDefaultPaymentMethod =
        !!customer.invoice_settings?.default_payment_method;
    } catch (error) {
      console.warn("Could not check customer payment method:", error);
    }
  }

  if (!invoice.items || invoice.items.length === 0) {
    throw new Error("Invoice has no line items");
  }

  let createdLineItemCount = 0;
  for (const item of invoice.items) {
    const quantity = Math.max(1, item.quantity || 1);
    const unitPrice =
      item.unitPrice > 0
        ? item.unitPrice
        : item.totalPrice > 0
          ? item.totalPrice / quantity
          : 0;
    const unitAmountInCents = Math.round(unitPrice * 100);

    if (unitAmountInCents <= 0) {
      console.warn(
        `[payments] skipping non-positive invoice item amount invoiceId=${args.invoiceId} service=${item.serviceName}`,
      );
      continue;
    }

    await stripeApiCall("invoiceitems", {
      method: "POST",
      body: new URLSearchParams({
        customer: stripeCustomerId,
        amount: unitAmountInCents.toString(),
        currency: "usd",
        quantity: quantity.toString(),
        description: item.serviceName,
      }),
    });
    createdLineItemCount += 1;
  }

  if (createdLineItemCount === 0) {
    throw new Error("No valid invoice line items were created in Stripe");
  }

  if (invoice.depositAmount && invoice.depositAmount > 0) {
    const depositAmountInCents = Math.round(invoice.depositAmount * 100);
    await stripeApiCall("invoiceitems", {
      method: "POST",
      body: new URLSearchParams({
        customer: stripeCustomerId,
        amount: `-${depositAmountInCents}`,
        currency: "usd",
        description: `Deposit payment (${invoice.invoiceNumber})`,
      }),
    });
  }

  const collectionMethod = hasDefaultPaymentMethod
    ? "charge_automatically"
    : "send_invoice";

  const invoiceParams = new URLSearchParams({
    customer: stripeCustomerId,
    collection_method: collectionMethod,
    auto_advance: "true",
    description: `Mobile detailing service - ${appointment.scheduledDate}`,
  });
  if (collectionMethod === "send_invoice") {
    invoiceParams.append("days_until_due", "30");
  }
  appendMetadata(invoiceParams, {
    invoiceId: String(args.invoiceId),
    appointmentId: String(args.appointmentId),
  });

  const stripeInvoice = await stripeApiCall("invoices", {
    method: "POST",
    body: invoiceParams,
  });
  console.log(
    `[payments] createStripeInvoiceAfterDeposit:invoiceCreated invoiceId=${args.invoiceId} stripeInvoiceId=${stripeInvoice.id} collectionMethod=${collectionMethod}`,
  );

  const finalizedInvoice = await stripeApiCall(`invoices/${stripeInvoice.id}/finalize`, {
    method: "POST",
  });

  const processedInvoice =
    collectionMethod === "send_invoice"
      ? await stripeApiCall(`invoices/${finalizedInvoice.id}/send`, {
          method: "POST",
        })
      : finalizedInvoice;

  let stripeInvoiceUrl =
    processedInvoice.hosted_invoice_url ||
    finalizedInvoice.hosted_invoice_url ||
    stripeInvoice.hosted_invoice_url;

  if (!stripeInvoiceUrl) {
    const fetchedInvoice = await stripeApiCall(`invoices/${finalizedInvoice.id}`, {
      method: "GET",
    });
    stripeInvoiceUrl = fetchedInvoice.hosted_invoice_url;
  }

  if (!stripeInvoiceUrl) {
    throw new Error(
      `Stripe invoice URL missing after invoice creation for ${args.invoiceId}`,
    );
  }

  try {
    await ctx.runMutation(internal.invoices.updateStripeInvoiceData, {
      invoiceId: args.invoiceId,
      stripeInvoiceId: processedInvoice.id || finalizedInvoice.id,
      stripeInvoiceUrl,
      status: "sent",
    });
    console.log(
      `[payments] createStripeInvoiceAfterDeposit:convexPatchSuccess invoiceId=${args.invoiceId} stripeInvoiceId=${processedInvoice.id || finalizedInvoice.id}`,
    );
  } catch (error) {
    console.error(
      `[payments] createStripeInvoiceAfterDeposit:convexPatchFailed invoiceId=${args.invoiceId}`,
      error,
    );
    throw error;
  }

  return {
    stripeInvoiceId: processedInvoice.id || finalizedInvoice.id,
    stripeInvoiceUrl,
  };
}

async function runBackfillMissingStripeInvoices(
  ctx: any,
  args: { dryRun?: boolean; limit?: number },
): Promise<BackfillSummary> {
  const dryRun = args.dryRun ?? true;
  const limit = Math.max(1, Math.min(500, Math.floor(args.limit ?? 50)));

  const allInvoices: any[] = await ctx.runQuery(api.invoices.listWithDetails, {});
  const candidateInvoices = allInvoices
    .filter(
      (invoice) =>
        invoice.depositPaid === true &&
        (invoice.remainingBalance ?? 0) > 0 &&
        (!invoice.stripeInvoiceId || !invoice.stripeInvoiceUrl),
    )
    .slice(0, limit);

  const summary: BackfillSummary = {
    scanned: allInvoices.length,
    candidates: candidateInvoices.length,
    patched: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  if (dryRun) {
    summary.skipped = candidateInvoices.length;
    return summary;
  }

  for (const invoice of candidateInvoices) {
    if (!invoice.appointmentId) {
      summary.failed += 1;
      summary.errors.push(`${invoice._id}: missing appointmentId`);
      continue;
    }

    const hasFalsePaidSignature =
      invoice.status === "paid" &&
      !!invoice.depositPaymentIntentId &&
      invoice.finalPaymentIntentId === invoice.depositPaymentIntentId;

    if (hasFalsePaidSignature) {
      await ctx.runMutation(internal.invoices.resetFalsePaidStateInternal, {
        invoiceId: invoice._id,
      });
      summary.patched += 1;
    } else if (invoice.status === "paid") {
      summary.skipped += 1;
      continue;
    }

    try {
      await createStripeInvoiceAfterDepositImpl(ctx, {
        invoiceId: invoice._id,
        appointmentId: invoice.appointmentId,
      });
      summary.succeeded += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push(
        `${invoice._id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return summary;
}

// === Payment Intents (for deposits and final payments) ===

// Create a Payment Intent for deposit or final payment
export const createPaymentIntent = action({
  args: {
    amount: v.number(), // Amount in dollars
    currency: v.string(),
    customerId: v.string(),
    invoiceId: v.id("invoices"),
    paymentType: v.union(v.literal("deposit"), v.literal("final_payment")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    // Convert amount to cents
    const amountInCents = Math.round(args.amount * 100);

    const paymentIntent = await stripeApiCall("payment_intents", {
      method: "POST",
      body: new URLSearchParams({
        amount: amountInCents.toString(),
        currency: args.currency,
        customer: args.customerId,
        metadata: JSON.stringify({
          invoiceId: args.invoiceId,
          type: args.paymentType,
          ...args.metadata,
        }),
        automatic_payment_methods: JSON.stringify({ enabled: true }),
      }),
    });

    return paymentIntent;
  },
});

// Confirm a Payment Intent (for immediate payment with saved payment method)
export const confirmPaymentIntent = action({
  args: {
    paymentIntentId: v.string(),
    paymentMethodId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    const params: any = {};
    if (args.paymentMethodId) {
      params.payment_method = args.paymentMethodId;
    }

    const paymentIntent = await stripeApiCall(
      `payment_intents/${args.paymentIntentId}/confirm`,
      {
        method: "POST",
        body: new URLSearchParams(params),
      },
    );

    return paymentIntent;
  },
});

// Get Payment Intent status
export const getPaymentIntent = action({
  args: {
    paymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    const paymentIntent = await stripeApiCall(
      `payment_intents/${args.paymentIntentId}`,
      {
        method: "GET",
      },
    );

    return paymentIntent;
  },
});

// === Payment Methods ===

// Get payment methods for a user
export const getPaymentMethods = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("paymentMethods"),
      stripePaymentMethodId: v.string(),
      type: v.union(v.literal("card"), v.literal("bank_account")),
      last4: v.string(),
      brand: v.optional(v.string()),
      isDefault: v.boolean(),
      createdAt: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const authUserId = await getUserIdFromIdentity(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own payment methods, admins can see all
    const isAdminUser = await isAdmin(ctx);
    if (!isAdminUser && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("paymentMethods")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Add a payment method
export const addPaymentMethod = mutation({
  args: {
    paymentMethodId: v.string(), // Stripe payment method ID
  },
  returns: v.id("paymentMethods"),
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get payment method details from Stripe
    const paymentMethod = await stripeApiCall(
      `payment_methods/${args.paymentMethodId}`,
    );

    // Check if this payment method already exists
    const existing = await ctx.db
      .query("paymentMethods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq("stripePaymentMethodId", args.paymentMethodId))
      .first();

    if (existing) {
      throw new Error("Payment method already exists");
    }

    // Check if user has any default payment method
    const hasDefault = await ctx.db
      .query("paymentMethods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();

    const paymentMethodDoc = {
      userId,
      stripePaymentMethodId: args.paymentMethodId,
      type: (paymentMethod.type === "card" ? "card" : "bank_account") as
        | "card"
        | "bank_account",
      last4:
        paymentMethod.type === "card"
          ? paymentMethod.card?.last4 || "****"
          : paymentMethod.us_bank_account?.last4 || "****",
      brand:
        paymentMethod.type === "card" ? paymentMethod.card?.brand : undefined,
      isDefault: !hasDefault, // Make this default if no other default exists
      createdAt: new Date().toISOString(),
    };

    return await ctx.db.insert("paymentMethods", paymentMethodDoc);
  },
});

// Set default payment method
export const setDefaultPaymentMethod = mutation({
  args: { paymentMethodId: v.id("paymentMethods") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    // First, unset all default payment methods for this user
    const userPaymentMethods = await ctx.db
      .query("paymentMethods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const pm of userPaymentMethods) {
      if (pm.isDefault) {
        await ctx.db.patch(pm._id, { isDefault: false });
      }
    }

    // Set the new default
    await ctx.db.patch(args.paymentMethodId, { isDefault: true });

    return null;
  },
});

// Delete a payment method
export const deletePaymentMethod = mutation({
  args: { paymentMethodId: v.id("paymentMethods") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const paymentMethod = await ctx.db.get(args.paymentMethodId);
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new Error("Payment method not found");
    }

    // Detach from Stripe
    await stripeApiCall(
      `payment_methods/${paymentMethod.stripePaymentMethodId}/detach`,
      {
        method: "POST",
      },
    );

    // Delete from database
    await ctx.db.delete(args.paymentMethodId);

    return null;
  },
});

// === Stripe Checkout ===

// Create a checkout session for deposit payment
export const createDepositCheckoutSession = action({
  args: {
    appointmentId: v.id("appointments"),
    invoiceId: v.id("invoices"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.string(),
  }),
  handler: async (
    ctx: any,
    args: any,
  ): Promise<{ sessionId: string; url: string }> => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get invoice and appointment details
    const invoice: any = await ctx.runQuery(api.invoices.getById, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.userId !== userId) throw new Error("Access denied");

    const appointment: any = await ctx.runQuery(api.appointments.getById, {
      appointmentId: args.appointmentId,
    });
    if (!appointment) throw new Error("Appointment not found");
    if (appointment.userId !== userId) throw new Error("Access denied");

    // Get user details
    const user: any = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) throw new Error("User not found");

    // Ensure Stripe customer exists (create if needed)
    // This handles cases where user was created but Stripe customer wasn't created yet
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      // Create Stripe customer on the fly
      stripeCustomerId = await ctx.runAction(
        internal.users.ensureStripeCustomer,
        {
          userId: user._id,
        },
      );
    }
    if (!stripeCustomerId?.trim()) {
      throw new Error("User not found or missing Stripe customer ID");
    }

    if (!invoice.depositAmount || invoice.depositAmount <= 0) {
      throw new Error("No deposit amount found for this invoice");
    }

    // Get deposit settings for price ID
    let depositPriceId: string | undefined;
    try {
      const depositSettings = await ctx.runQuery(api.depositSettings.get, {});
      depositPriceId = depositSettings?.stripePriceId;
    } catch (error) {
      // If we can't get deposit settings, we'll use amount-based checkout
      console.warn("Could not fetch deposit settings for price:", error);
    }

    // Calculate quantity (number of vehicles)
    const vehicleCount = appointment.vehicleIds.length;

    // Create Stripe checkout session for deposit
    if (depositPriceId) {
      // Use Stripe component when we have a priceId
      const session = await stripeClient.createCheckoutSession(ctx, {
        priceId: depositPriceId,
        customerId: stripeCustomerId,
        mode: "payment",
        successUrl: args.successUrl,
        cancelUrl: args.cancelUrl,
        quantity: vehicleCount,
        metadata: {
          appointmentId: args.appointmentId,
          invoiceId: args.invoiceId,
          type: "deposit",
        },
        paymentIntentMetadata: {
          appointmentId: args.appointmentId,
          invoiceId: args.invoiceId,
          type: "deposit",
        },
      });

      if (!session.url) {
        throw new Error("Failed to create checkout session URL");
      }

      return {
        sessionId: session.sessionId,
        url: session.url,
      };
    } else {
      // Fallback: use manual approach for dynamic amounts (price_data)
      // Component doesn't support price_data, so we use manual API call
      const sessionData = new URLSearchParams({
        mode: "payment",
        customer: stripeCustomerId,
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        "metadata[appointmentId]": args.appointmentId,
        "metadata[invoiceId]": args.invoiceId,
        "metadata[type]": "deposit",
      });

      // invoice.depositAmount is already the total (deposit per vehicle × vehicle count)
      const depositAmountInCents = Math.round(invoice.depositAmount * 100);
      sessionData.append("line_items[0][price_data][currency]", "usd");
      sessionData.append(
        "line_items[0][price_data][unit_amount]",
        depositAmountInCents.toString(),
      );
      sessionData.append(
        "line_items[0][price_data][product_data][name]",
        `Deposit (${vehicleCount} vehicle${vehicleCount > 1 ? "s" : ""})`,
      );
      sessionData.append("line_items[0][quantity]", "1");

      const session = await stripeApiCall("checkout/sessions", {
        method: "POST",
        body: sessionData,
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    }
  },
});

// Note: Remaining balance payments are now handled via Stripe Invoices
// Customers can pay via the hosted invoice URL (stripeInvoiceUrl)
// or the invoice will be automatically charged if they have a card on file

// Create a checkout session for an invoice
export const createCheckoutSession = action({
  args: {
    invoiceId: v.id("invoices"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.string(),
  }),
  handler: async (
    ctx: any,
    args: any,
  ): Promise<{ sessionId: string; url: string }> => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get invoice details
    const invoice: any = await ctx.runQuery(api.invoices.getById, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.userId !== userId) throw new Error("Access denied");

    // Get user details
    const user: any = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) throw new Error("User not found");

    // Create Stripe checkout session
    const sessionData = new URLSearchParams({
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": `Invoice ${invoice.invoiceNumber}`,
      "line_items[0][price_data][product_data][description]":
        "Payment for mobile detailing services",
      "line_items[0][price_data][unit_amount]": Math.round(
        invoice.total * 100,
      ).toString(),
      "line_items[0][quantity]": "1",
      mode: "payment",
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      customer_email: user.email,
      "metadata[invoiceId]": args.invoiceId,
      "metadata[userId]": userId,
    });

    const session = await stripeApiCall("checkout/sessions", {
      method: "POST",
      body: sessionData,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

// === Internal Helper: Create Stripe Invoice After Deposit ===

// Internal action to create Stripe Invoice with all service line items after deposit is paid
export const createStripeInvoiceAfterDeposit = internalAction({
  args: {
    invoiceId: v.id("invoices"),
    appointmentId: v.id("appointments"),
  },
  returns: v.object({
    stripeInvoiceId: v.string(),
    stripeInvoiceUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    return await createStripeInvoiceAfterDepositImpl(ctx, args);
  },
});

export const backfillMissingStripeInvoicesInternal = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: backfillSummaryValidator,
  handler: async (ctx, args): Promise<BackfillSummary> => {
    return await runBackfillMissingStripeInvoices(ctx, args);
  },
});

export const backfillMissingStripeInvoices = action({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: backfillSummaryValidator,
  handler: async (ctx, args): Promise<BackfillSummary> => {
    const role = await ctx.runQuery(api.auth.getUserRole, {});
    if (role?.type !== "admin") {
      throw new Error("Admin access required");
    }

    return await runBackfillMissingStripeInvoices(ctx, args);
  },
});

// Backward-compatible alias for clients that still call the "Mutation" endpoint name.
// This is an action because backfill performs external Stripe calls.
export const backfillMissingStripeInvoicesMutation = action({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: backfillSummaryValidator,
  handler: async (ctx, args): Promise<BackfillSummary> => {
    const role = await ctx.runQuery(api.auth.getUserRole, {});
    if (role?.type !== "admin") {
      throw new Error("Admin access required");
    }

    return await runBackfillMissingStripeInvoices(ctx, args);
  },
});

// === Webhook Handler ===

// Handle Stripe webhooks
export const handleWebhook = action({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret)
      throw new Error("Stripe webhook secret not configured");

    // Parse the event from the raw body
    let event: any;
    try {
      event = JSON.parse(args.body);
    } catch (err) {
      throw new Error(`Invalid JSON in webhook body: ${err}`);
    }

    // For now, skip signature verification in development
    // In production, you should implement proper webhook signature verification
    // using crypto libraries compatible with Convex runtime

    // Handle the event
    switch (event.type) {
      // Invoice lifecycle events (primary for our invoice-based flow)
      case "invoice.created": {
        const invoice = event.data.object;
        console.log(`Invoice created: ${invoice.id}`);
        // Invoice was created - we already have it in our DB
        break;
      }

      case "invoice.finalized": {
        const invoice = event.data.object;
        console.log(`Invoice finalized: ${invoice.id}`);
        // Invoice is now open and ready for payment
        // Could update status if needed
        break;
      }

      case "invoice.sent": {
        const invoice = event.data.object;
        console.log(`Invoice sent: ${invoice.id}`);
        // Invoice was emailed to customer
        break;
      }

      case "invoice.paid": {
        const stripeInvoice = event.data.object;
        console.log(`Invoice paid: ${stripeInvoice.id}`);

        // Find our invoice by Stripe invoice ID
        const ourInvoice = await ctx.runQuery(api.invoices.getByStripeId, {
          stripeInvoiceId: stripeInvoice.id,
        });

        if (ourInvoice && ourInvoice.status !== "paid") {
          // Update invoice status to paid
          await ctx.runMutation(internal.invoices.updateStatusInternal, {
            invoiceId: ourInvoice._id,
            status: "paid",
            paidDate: new Date().toISOString().split("T")[0],
          });

          // Update user stats when invoice is fully paid
          const appointment = await ctx.runQuery(
            internal.appointments.getByIdInternal,
            {
              appointmentId: ourInvoice.appointmentId,
            },
          );
          if (appointment) {
            const user = await ctx.runQuery(internal.users.getByIdInternal, {
              userId: appointment.userId,
            });
            if (user) {
              await ctx.runMutation(internal.users.updateStats, {
                userId: appointment.userId,
                timesServiced: (user.timesServiced || 0) + 1,
                totalSpent: (user.totalSpent || 0) + ourInvoice.total,
              });
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`Invoice payment failed: ${invoice.id}`);

        // Find our invoice by Stripe invoice ID
        const ourInvoice = await ctx.runQuery(api.invoices.getByStripeId, {
          stripeInvoiceId: invoice.id,
        });

        if (ourInvoice) {
          // Could add a payment_failed status or log the failure
          console.log(`Payment failed for our invoice ${ourInvoice._id}`);
        }
        break;
      }

      case "invoice.voided": {
        const invoice = event.data.object;
        console.log(`Invoice voided: ${invoice.id}`);

        // Find our invoice by Stripe invoice ID
        const ourInvoice = await ctx.runQuery(api.invoices.getByStripeId, {
          stripeInvoiceId: invoice.id,
        });

        if (ourInvoice) {
          // Mark as voided/overdue
          await ctx.runMutation(api.invoices.updateStatus, {
            invoiceId: ourInvoice._id,
            status: "overdue",
          });
        }
        break;
      }

      case "invoice.updated": {
        const invoice = event.data.object;
        console.log(`Invoice updated: ${invoice.id}`);
        // Could sync amount or status changes if needed
        break;
      }

      // Checkout session completed - handle deposit payments
      case "checkout.session.completed": {
        const session = event.data.object;
        const invoiceIdString = session.metadata?.invoiceId;
        const paymentType = session.metadata?.type; // "deposit" or undefined

        if (invoiceIdString && paymentType === "deposit") {
          const invoiceId = invoiceIdString as Id<"invoices">;
          const invoice = await ctx.runQuery(
            internal.invoices.getByIdInternal,
            {
              invoiceId,
            },
          );

          if (invoice && !invoice.depositPaid) {
            const paymentIntentId = session.payment_intent as
              | string
              | undefined;

            // Mark deposit as paid
            await ctx.runMutation(
              internal.invoices.updateDepositStatusInternal,
              {
                invoiceId,
                depositPaid: true,
                depositPaymentIntentId: paymentIntentId,
                status: "draft", // Will be updated to "sent" after Stripe invoice is created
              },
            );

            // Route through appointment status mutation (single source of truth for invoice generation)
            const appointment = await ctx.runQuery(
              internal.appointments.getByIdInternal,
              {
                appointmentId: invoice.appointmentId,
              },
            );
            if (
              appointment &&
              (appointment.status === "pending" ||
                appointment.status === "confirmed")
            ) {
              await ctx.runMutation(
                internal.appointments.updateStatusInternal,
                {
                  appointmentId: invoice.appointmentId,
                  status: "confirmed",
                },
              );
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const invoiceIdString = paymentIntent.metadata?.invoiceId;
        const paymentType = paymentIntent.metadata?.type;

        if (!invoiceIdString) break;

        const invoiceId = invoiceIdString as Id<"invoices">;
        const invoice = await ctx.runQuery(internal.invoices.getByIdInternal, {
          invoiceId,
        });
        if (!invoice) break;

        if (paymentType === "deposit") {
          // Deposit payment succeeded via direct payment intent
          // This is a backup handler in case checkout.session.completed didn't fire
          if (!invoice.depositPaid) {
            await ctx.runMutation(
              internal.invoices.updateDepositStatusInternal,
              {
                invoiceId,
                depositPaid: true,
                depositPaymentIntentId: paymentIntent.id,
                status: "draft",
              },
            );

            // Route through appointment status mutation (single source of truth for invoice generation)
            const appointment = await ctx.runQuery(
              internal.appointments.getByIdInternal,
              {
                appointmentId: invoice.appointmentId,
              },
            );
            if (
              appointment &&
              (appointment.status === "pending" ||
                appointment.status === "confirmed")
            ) {
              await ctx.runMutation(
                internal.appointments.updateStatusInternal,
                {
                  appointmentId: invoice.appointmentId,
                  status: "confirmed",
                },
              );
            }
          }
        } else if (
          paymentType === "final_payment" &&
          invoice.status !== "paid"
        ) {
          // Final payment succeeded (e.g. direct payment intent for remaining balance)
          await ctx.runMutation(internal.invoices.updateFinalPaymentInternal, {
            invoiceId,
            finalPaymentIntentId: paymentIntent.id,
          });
          await ctx.runMutation(internal.invoices.updateStatusInternal, {
            invoiceId,
            status: "paid",
            paidDate: new Date().toISOString().split("T")[0],
          });
          // Update user stats
          const appointment = await ctx.runQuery(
            internal.appointments.getByIdInternal,
            { appointmentId: invoice.appointmentId },
          );
          if (appointment) {
            const user = await ctx.runQuery(internal.users.getByIdInternal, {
              userId: appointment.userId,
            });
            if (user) {
              await ctx.runMutation(internal.users.updateStats, {
                userId: appointment.userId,
                timesServiced: (user.timesServiced || 0) + 1,
                totalSpent: (user.totalSpent || 0) + invoice.total,
              });
            }
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const invoiceIdString = paymentIntent.metadata?.invoiceId;
        const paymentType = paymentIntent.metadata?.type;

        if (invoiceIdString) {
          const invoiceId = invoiceIdString as Id<"invoices">;
          console.log(
            `Payment failed for invoice ${invoiceId}, type: ${paymentType}`,
          );
          // Could add retry logic or notification here
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object;
        const invoiceIdString = paymentIntent.metadata?.invoiceId;

        if (invoiceIdString) {
          const invoiceId = invoiceIdString as Id<"invoices">;
          console.log(`Payment canceled for invoice ${invoiceId}`);
        }
        break;
      }

      // Customer events
      case "customer.created": {
        const customer = event.data.object;
        console.log(`Customer created: ${customer.id}`);
        // Could sync customer data if needed
        break;
      }

      default:
        // Avoid noisy test output while still logging unknown events in real environments.
        if (
          process.env.NODE_ENV !== "test" &&
          process.env.CONVEX_TEST !== "true"
        ) {
          console.log(`Unhandled event type ${event.type}`);
        }
    }

    return null;
  },
});

// Sync payment status from Stripe (for fixing missed webhooks)
export const syncPaymentStatus = action({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invoice: any = await ctx.runQuery(api.invoices.getById, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.userId !== userId) throw new Error("Access denied");

    // Get user to find Stripe customer ID
    const user: any = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user || !user.stripeCustomerId) {
      throw new Error("User does not have a Stripe customer ID");
    }

    let updated = false;

    // Check deposit payment intent if it exists
    if (invoice.depositPaymentIntentId) {
      try {
        const paymentIntent = await stripeApiCall(
          `payment_intents/${invoice.depositPaymentIntentId}`,
          { method: "GET" },
        );

        if (paymentIntent.status === "succeeded" && !invoice.depositPaid) {
          await ctx.runMutation(api.invoices.updateDepositStatus, {
            invoiceId: args.invoiceId,
            depositPaid: true,
            depositPaymentIntentId: invoice.depositPaymentIntentId,
          });
          updated = true;
        }
      } catch (error) {
        console.warn(
          `Could not sync deposit payment intent ${invoice.depositPaymentIntentId}:`,
          error,
        );
      }
    } else if (
      !invoice.depositPaid &&
      invoice.depositAmount &&
      invoice.depositAmount > 0
    ) {
      // Try to find payment intent by searching recent payment intents for this customer
      // that match the deposit amount
      try {
        const depositAmountInCents = Math.round(invoice.depositAmount * 100);
        const paymentIntents = await stripeApiCall(
          `payment_intents?customer=${user.stripeCustomerId}&limit=10`,
          { method: "GET" },
        );

        // Find a succeeded payment intent that matches the deposit amount
        const matchingPaymentIntent = paymentIntents.data?.find(
          (pi: any) =>
            pi.amount === depositAmountInCents &&
            pi.status === "succeeded" &&
            pi.created >= invoice._creationTime / 1000 - 3600, // Within 1 hour of invoice creation
        );

        if (matchingPaymentIntent) {
          await ctx.runMutation(api.invoices.updateDepositStatus, {
            invoiceId: args.invoiceId,
            depositPaid: true,
            depositPaymentIntentId: matchingPaymentIntent.id,
          });
          updated = true;
        }
      } catch (error) {
        console.warn("Could not search for deposit payment intent:", error);
      }
    }

    // Check final payment intent if it exists.
    // Never treat the deposit payment intent as the final payment intent.
    if (invoice.finalPaymentIntentId) {
      if (
        invoice.depositPaymentIntentId &&
        invoice.finalPaymentIntentId === invoice.depositPaymentIntentId
      ) {
        console.warn(
          `[payments] Skipping final payment sync for ${args.invoiceId} because finalPaymentIntentId matches depositPaymentIntentId`,
        );
      } else {
        try {
          const paymentIntent = await stripeApiCall(
            `payment_intents/${invoice.finalPaymentIntentId}`,
            { method: "GET" },
          );

          if (paymentIntent.status === "succeeded" && invoice.status !== "paid") {
            await ctx.runMutation(api.invoices.updateStatus, {
              invoiceId: args.invoiceId,
              status: "paid",
              paidDate: new Date().toISOString().split("T")[0],
            });
            updated = true;
          }
        } catch (error) {
          console.warn(
            `Could not sync final payment intent ${invoice.finalPaymentIntentId}:`,
            error,
          );
        }
      }
    } else if (invoice.stripeInvoiceId && invoice.status !== "paid") {
      try {
        const stripeInvoice = await stripeApiCall(
          `invoices/${invoice.stripeInvoiceId}`,
          { method: "GET" },
        );
        if (stripeInvoice.status === "paid") {
          await ctx.runMutation(api.invoices.updateStatus, {
            invoiceId: args.invoiceId,
            status: "paid",
            paidDate: new Date().toISOString().split("T")[0],
          });
          updated = true;
        }
      } catch (error) {
        console.warn(
          `Could not sync Stripe invoice ${invoice.stripeInvoiceId}:`,
          error,
        );
      }
    }

    return { success: true, updated };
  },
});
