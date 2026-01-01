import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
    const userId = await getAuthUserId(ctx);
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
    const sessionData = new URLSearchParams({
      mode: "payment",
      customer: stripeCustomerId,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      "metadata[appointmentId]": args.appointmentId,
      "metadata[invoiceId]": args.invoiceId,
      "metadata[type]": "deposit",
    });

    if (depositPriceId) {
      // Use Stripe price ID with quantity (deposit per vehicle)
      sessionData.append("line_items[0][price]", depositPriceId);
      sessionData.append("line_items[0][quantity]", vehicleCount.toString());
    } else {
      // Fallback: use amount directly
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
    }

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

// Create checkout session for remaining balance payment
export const createRemainingBalanceCheckoutSession = action({
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
    const userId = await getAuthUserId(ctx);
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

    if (!invoice.depositPaid) {
      throw new Error("Deposit must be paid before paying remaining balance");
    }

    const remainingBalance = Math.max(
      0,
      invoice.remainingBalance || invoice.total - (invoice.depositAmount || 0),
    );
    if (remainingBalance <= 0) {
      throw new Error("No remaining balance to pay");
    }

    // Create Stripe checkout session for remaining balance
    const sessionData = new URLSearchParams({
      mode: "payment",
      customer: stripeCustomerId,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      "metadata[appointmentId]": args.appointmentId,
      "metadata[invoiceId]": args.invoiceId,
      "metadata[type]": "remaining_balance",
    });

    // Use amount directly for remaining balance
    const remainingBalanceInCents = Math.round(remainingBalance * 100);
    sessionData.append("line_items[0][price_data][currency]", "usd");
    sessionData.append(
      "line_items[0][price_data][unit_amount]",
      remainingBalanceInCents.toString(),
    );
    sessionData.append(
      "line_items[0][price_data][product_data][name]",
      `Remaining Balance - Invoice ${invoice.invoiceNumber}`,
    );
    sessionData.append(
      "line_items[0][price_data][product_data][description]",
      "Payment for remaining balance after deposit",
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
  },
});

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
        const invoice = event.data.object;
        console.log(`Invoice paid: ${invoice.id}`);

        // Find our invoice by Stripe invoice ID
        const ourInvoice = await ctx.runQuery(api.invoices.getByStripeId, {
          stripeInvoiceId: invoice.id,
        });

        if (ourInvoice) {
          await ctx.runMutation(api.invoices.updateStatus, {
            invoiceId: ourInvoice._id,
            status: "paid",
            paidDate: new Date().toISOString().split("T")[0],
          });
          // User stats are automatically updated in appointment creation
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

      // Payment intent events (for checkout sessions or direct payments)
      case "checkout.session.completed": {
        const session = event.data.object;
        const invoiceIdString = session.metadata?.invoiceId;
        const paymentType = session.metadata?.type; // "deposit" or undefined (legacy)
        const paymentIntentId = session.payment_intent as string | undefined;

        if (invoiceIdString) {
          const invoiceId = invoiceIdString as Id<"invoices">;
          const invoice = await ctx.runQuery(internal.invoices.getByIdInternal, {
            invoiceId,
          });

          if (invoice) {
            if (paymentType === "deposit") {
              // Deposit payment completed via checkout
              // Store payment intent ID and mark deposit as paid
              await ctx.runMutation(
                internal.invoices.updateDepositStatusInternal,
                {
                  invoiceId,
                  depositPaid: true,
                  depositPaymentIntentId: paymentIntentId,
                  status: "draft", // Keep as draft until admin confirms and generates invoice
                },
              );

              // Auto-confirm appointment when deposit is paid
              const appointment = await ctx.runQuery(
                internal.appointments.getByIdInternal,
                {
                  appointmentId: invoice.appointmentId,
                },
              );
              if (appointment && appointment.status === "pending") {
                await ctx.runMutation(
                  internal.appointments.updateStatusInternal,
                  {
                    appointmentId: invoice.appointmentId,
                    status: "confirmed",
                  },
                );
              }
            } else if (
              paymentType === "final_payment" ||
              paymentType === "remaining_balance"
            ) {
              // Final payment or remaining balance completed
              await ctx.runMutation(internal.invoices.updateStatusInternal, {
                invoiceId,
                status: "paid",
                paidDate: new Date().toISOString().split("T")[0],
              });
              if (paymentIntentId) {
                await ctx.runMutation(
                  internal.invoices.updateFinalPaymentInternal,
                  {
                    invoiceId,
                    finalPaymentIntentId: paymentIntentId,
                  },
                );
              }

              // Update user stats only when payment actually succeeds
              // Get appointment to find the user
              const appointment = await ctx.runQuery(
                internal.appointments.getByIdInternal,
                {
                  appointmentId: invoice.appointmentId,
                },
              );
              if (appointment) {
                const user = await ctx.runQuery(
                  internal.users.getByIdInternal,
                  {
                    userId: appointment.userId,
                  },
                );
                if (user) {
                  await ctx.runMutation(internal.users.updateStats, {
                    userId: appointment.userId,
                    timesServiced: (user.timesServiced || 0) + 1,
                    totalSpent: (user.totalSpent || 0) + invoice.total,
                  });
                }
              }
            } else {
              // Legacy: treat as full payment
              await ctx.runMutation(internal.invoices.updateStatusInternal, {
                invoiceId,
                status: "paid",
                paidDate: new Date().toISOString().split("T")[0],
              });
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const invoiceIdString = paymentIntent.metadata?.invoiceId;
        const paymentType = paymentIntent.metadata?.type; // "deposit" or "final_payment"

        // Note: checkout.session.completed should handle most cases
        // This handler is a backup for direct payment intents or if checkout handler missed it
        if (invoiceIdString) {
          // Convert string ID from metadata to Convex Id type
          const invoiceId = invoiceIdString as Id<"invoices">;
          const invoice = await ctx.runQuery(internal.invoices.getByIdInternal, {
            invoiceId,
          });

          if (invoice) {
            if (paymentType === "deposit") {
              // Deposit payment succeeded
              // Only update if not already marked as paid (avoid duplicate updates)
              if (!invoice.depositPaid) {
                await ctx.runMutation(
                  internal.invoices.updateDepositStatusInternal,
                  {
                    invoiceId,
                    depositPaid: true,
                    depositPaymentIntentId: paymentIntent.id,
                    status: "draft", // Keep as draft until admin confirms
                  },
                );
              } else if (!invoice.depositPaymentIntentId) {
                // Update payment intent ID if missing
                await ctx.runMutation(
                  internal.invoices.updateDepositStatusInternal,
                  {
                    invoiceId,
                    depositPaid: true,
                    depositPaymentIntentId: paymentIntent.id,
                  },
                );
              }
            } else if (
              paymentType === "final_payment" ||
              paymentType === "remaining_balance"
            ) {
              // Final payment succeeded
              await ctx.runMutation(internal.invoices.updateStatusInternal, {
                invoiceId,
                status: "paid",
                paidDate: new Date().toISOString().split("T")[0],
              });

              // Update final payment intent ID
              await ctx.runMutation(
                internal.invoices.updateFinalPaymentInternal,
                {
                  invoiceId,
                  finalPaymentIntentId: paymentIntent.id,
                },
              );

              // Update user stats only when payment actually succeeds
              // Get appointment to find the user
              const appointment = await ctx.runQuery(
                internal.appointments.getByIdInternal,
                {
                  appointmentId: invoice.appointmentId,
                },
              );
              if (appointment) {
                const user = await ctx.runQuery(
                  internal.users.getByIdInternal,
                  {
                    userId: appointment.userId,
                  },
                );
                if (user) {
                  await ctx.runMutation(internal.users.updateStats, {
                    userId: appointment.userId,
                    timesServiced: (user.timesServiced || 0) + 1,
                    totalSpent: (user.totalSpent || 0) + invoice.total,
                  });
                }
              }
            } else {
              // Legacy: treat as full payment
              await ctx.runMutation(internal.invoices.updateStatusInternal, {
                invoiceId,
                status: "paid",
                paidDate: new Date().toISOString().split("T")[0],
              });
            }
          }
        }
        // If metadata is missing, checkout.session.completed should have already handled it
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
        console.log(`Unhandled event type ${event.type}`);
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
    const userId = await getAuthUserId(ctx);
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

    // Check final payment intent if it exists
    if (invoice.finalPaymentIntentId) {
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
    } else if (
      invoice.depositPaid &&
      invoice.remainingBalance &&
      invoice.remainingBalance > 0 &&
      invoice.status !== "paid"
    ) {
      // Try to find final payment intent by searching recent payment intents for this customer
      // that match the remaining balance amount
      try {
        const remainingBalanceInCents = Math.round(
          invoice.remainingBalance * 100,
        );
        const paymentIntents = await stripeApiCall(
          `payment_intents?customer=${user.stripeCustomerId}&limit=20`,
          { method: "GET" },
        );

        // Find a succeeded payment intent that matches the remaining balance amount
        // and was created after the deposit was paid
        const matchingPaymentIntent = paymentIntents.data?.find(
          (pi: any) =>
            pi.amount === remainingBalanceInCents &&
            pi.status === "succeeded" &&
            pi.created >= invoice._creationTime / 1000 - 86400, // Within 24 hours of invoice creation
        );

        if (matchingPaymentIntent) {
          await ctx.runMutation(api.invoices.updateStatus, {
            invoiceId: args.invoiceId,
            status: "paid",
            paidDate: new Date().toISOString().split("T")[0],
          });
          await ctx.runMutation(api.invoices.updateFinalPayment, {
            invoiceId: args.invoiceId,
            finalPaymentIntentId: matchingPaymentIntent.id,
          });
          updated = true;
        }
      } catch (error) {
        console.warn("Could not search for final payment intent:", error);
      }
    }

    return { success: true, updated };
  },
});
