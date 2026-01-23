import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal, components } from "./_generated/api";
import { resend } from "./emails";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";
import { registerRoutes } from "@convex-dev/stripe";
import type Stripe from "stripe";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

// Register Stripe component webhook handler (handles data sync to component tables)
// The component verifies webhook signatures and syncs data automatically
// We add custom event handlers for our business logic
registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    // Handle deposit payment completion
    "checkout.session.completed": async (
      ctx,
      event: Stripe.CheckoutSessionCompletedEvent,
    ) => {
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

          // Create Stripe Invoice with all service line items
          try {
            await ctx.runAction(
              internal.payments.createStripeInvoiceAfterDeposit,
              {
                invoiceId,
                appointmentId: invoice.appointmentId,
              },
            );
          } catch (error) {
            console.error(
              "Failed to create Stripe invoice after deposit:",
              error,
            );
            // Don't throw - deposit is paid, invoice creation can be retried
          }
        }
      }
    },

    // Handle payment intent success (backup for deposit payments)
    "payment_intent.succeeded": async (
      ctx,
      event: Stripe.PaymentIntentSucceededEvent,
    ) => {
      const paymentIntent = event.data.object;
      const invoiceIdString = paymentIntent.metadata?.invoiceId;
      const paymentType = paymentIntent.metadata?.type;

      // Only handle deposit payments here (final payments are handled via invoice.paid)
      if (invoiceIdString && paymentType === "deposit") {
        const invoiceId = invoiceIdString as Id<"invoices">;
        const invoice = await ctx.runQuery(
          internal.invoices.getByIdInternal,
          {
            invoiceId,
          },
        );

        if (invoice && !invoice.depositPaid) {
          // Deposit payment succeeded via direct payment intent
          // This is a backup handler in case checkout.session.completed didn't fire
          await ctx.runMutation(
            internal.invoices.updateDepositStatusInternal,
            {
              invoiceId,
              depositPaid: true,
              depositPaymentIntentId: paymentIntent.id,
              status: "draft",
            },
          );

          // Auto-confirm appointment
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

          // Create Stripe Invoice after deposit
          try {
            await ctx.runAction(
              internal.payments.createStripeInvoiceAfterDeposit,
              {
                invoiceId,
                appointmentId: invoice.appointmentId,
              },
            );
          } catch (error) {
            console.error(
              "Failed to create Stripe invoice after deposit:",
              error,
            );
          }
        }
      }
    },

    // Handle invoice payment
    "invoice.paid": async (ctx, event: Stripe.InvoicePaidEvent) => {
      const stripeInvoice = event.data.object;

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
    },

    // Handle invoice payment failure
    "invoice.payment_failed": async (
      ctx,
      event: Stripe.InvoicePaymentFailedEvent,
    ) => {
      const invoice = event.data.object;

      // Find our invoice by Stripe invoice ID
      const ourInvoice = await ctx.runQuery(api.invoices.getByStripeId, {
        stripeInvoiceId: invoice.id,
      });

      if (ourInvoice) {
        console.log(`Payment failed for our invoice ${ourInvoice._id}`);
        // Could add a payment_failed status or log the failure
      }
    },

    // Handle invoice voided
    "invoice.voided": async (ctx, event: Stripe.InvoiceVoidedEvent) => {
      const invoice = event.data.object;

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
    },
  },
});

// Resend webhook endpoint for email status tracking
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req);
  }),
});

// Clerk webhook endpoint for user sync
http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const event = await validateClerkWebhook(req);
    if (!event) {
      return new Response("Error occurred", { status: 400 });
    }

    switch (event.type) {
      case "user.created": // Intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, {
          clerkUserId,
        });
        break;
      }

      default:
        console.log("Ignored Clerk webhook event:", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateClerkWebhook(
  req: Request,
): Promise<WebhookEvent | null> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return null;
  }

  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };

  const wh = new Webhook(webhookSecret);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying Clerk webhook event:", error);
    return null;
  }
}

export default http;
