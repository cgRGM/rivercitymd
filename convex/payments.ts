import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Get Stripe secret key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY environment variable is not set. Please set it in your Convex environment.",
  );
}

// Helper function to make Stripe API calls
async function stripeApiCall(endpoint: string, options: RequestInit = {}) {
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
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own payment methods, admins can see all
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
      case "checkout.session.completed": {
        const session = event.data.object;
        const invoiceId = session.metadata?.invoiceId;

        if (invoiceId) {
          await ctx.runMutation(api.invoices.updateStatus, {
            invoiceId: invoiceId,
            status: "paid",
            paidDate: new Date().toISOString().split("T")[0],
          });
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const invoiceId = paymentIntent.metadata?.invoiceId;

        if (invoiceId) {
          await ctx.runMutation(api.invoices.updateStatus, {
            invoiceId: invoiceId,
            status: "paid",
            paidDate: new Date().toISOString().split("T")[0],
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const invoiceId = paymentIntent.metadata?.invoiceId;

        if (invoiceId) {
          // Could update invoice status to indicate payment failure
          console.log(`Payment failed for invoice ${invoiceId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return null;
  },
});
