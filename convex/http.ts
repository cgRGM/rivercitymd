import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { resend } from "./emails";
import { registerTwilioRoutes } from "./sms";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";
import { registerRoutes } from "@convex-dev/stripe";
import type Stripe from "stripe";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

registerTwilioRoutes(http);

// Register Stripe component webhook handler (handles data sync to component tables)
// The component verifies webhook signatures and syncs data automatically
// We add custom event handlers for our business logic
import { createClerkClient } from "@clerk/backend";

// Initialize Clerk client (ensure CLERK_SECRET_KEY is set in env vars)
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    // Handle deposit payment completion
    "checkout.session.completed": async (
      ctx,
      event: Stripe.CheckoutSessionCompletedEvent,
    ) => {
      const session = event.data.object;

      // --- Handle subscription checkout ---
      if (session.mode === "subscription" && session.metadata?.subscriptionId) {
        const subscriptionId = session.metadata.subscriptionId as Id<"subscriptions">;
        const stripeSubscriptionId = session.subscription as string;
        console.log(
          `[stripe-webhook] subscription checkout completed subscriptionId=${subscriptionId} stripeSubscriptionId=${stripeSubscriptionId}`,
        );

        // Activate the subscription
        await ctx.runMutation(internal.subscriptions.activate, {
          subscriptionId,
          stripeSubscriptionId,
        });

        // Create the first appointment
        await ctx.scheduler.runAfter(0, internal.subscriptions.createNextAppointment, {
          subscriptionId,
        });
        return;
      }

      const invoiceIdString = session.metadata?.invoiceId;
      const paymentType = session.metadata?.type; // "deposit", "full", or undefined

      if (invoiceIdString && (paymentType === "deposit" || paymentType === "full")) {
        const invoiceId = invoiceIdString as Id<"invoices">;
        console.log(
          `[stripe-webhook] deposit checkout completed sessionId=${session.id} invoiceId=${invoiceId}`,
        );
        const invoice = await ctx.runQuery(
          internal.invoices.getByIdInternal,
          {
            invoiceId,
          },
        );

        if (!invoice) {
          console.error(
            `[stripe-webhook] deposit checkout invoice not found invoiceId=${invoiceId}`,
          );
          return;
        }

        // --- NEW: Handle Post-Payment User Onboarding / Invitations ---
        // Get the appointment and user to check onboarding status
        const appointment = await ctx.runQuery(
            internal.appointments.getByIdInternal,
            { appointmentId: invoice.appointmentId }
        );

        if (appointment) {
            const user = await ctx.runQuery(internal.users.getByIdInternal, {
                userId: appointment.userId,
            });

            if (user && !user.clerkUserId) {
                // User has no Clerk ID -> This is likely a Guest Checkout.
                // Trigger Invitation via Clerk Backend API.
                console.log(`[stripe-webhook] User ${user._id} has no Clerk ID. Initiating invitation flow.`);

                if (user.email) {
                    try {
                        const redirectUrl = `${process.env.CONVEX_SITE_URL}/dashboard`;
                        // Create invitation
                        // Note: Using a catch block to handle "already invited" scenarios gracefully
                        await clerkClient.invitations.createInvitation({
                            emailAddress: user.email,
                            redirectUrl: redirectUrl,
                            publicMetadata: {
                                convexUserId: user._id,
                                role: "client"
                            },
                             ignoreExisting: true // Don't throw if already invited
                        });
                        console.log(`[stripe-webhook] Invitation sent to ${user.email}`);

                         // Also trigger the internal onboarding notification (Admin Alert)
                         // We do this here (post-payment) to confirm they are a real customer.
                         await ctx.runMutation(internal.notifications.queueNewCustomerOnboarded, {
                             userId: user._id,
                             transition: "payment_complete"
                         });

                    } catch (err) {
                        console.error(`[stripe-webhook] Failed to send Clerk invitation to ${user.email}`, err);
                    }
                } else {
                     console.warn(`[stripe-webhook] User ${user._id} has no email, cannot send invitation.`);
                }
            } else if (user) {
                // User ALREADY has Clerk ID. They might still need the "Onboarded" admin alert if this was their first real booking?
                // But usually if they have Clerk ID, they might be returning.
                // We'll leave it for now, as `queueNewCustomerOnboarded` was primarily for new accounts.
            }
        }
        // -----------------------------------------------------------

        if (paymentType === "full") {
          // Full payment — mark invoice as completely paid
          if (invoice.status === "paid") {
            console.log(
              `[stripe-webhook] full payment already processed invoiceId=${invoiceId}`,
            );
            return;
          }

          const paymentIntentId = session.payment_intent as string | undefined;
          const today = new Date().toISOString().split("T")[0];

          await ctx.runMutation(
            internal.invoices.updateStatusInternal,
            {
              invoiceId,
              status: "paid",
              paidDate: today,
            },
          );

          // Also mark deposit as paid and set remaining balance to 0
          await ctx.runMutation(
            internal.invoices.updateDepositStatusInternal,
            {
              invoiceId,
              depositPaid: true,
              depositPaymentIntentId: paymentIntentId,
            },
          );

          console.log(
            `[stripe-webhook] full payment captured invoiceId=${invoiceId} paymentIntentId=${paymentIntentId || "none"}`,
          );

          // Update user stats immediately since invoice is fully paid
          if (appointment) {
            const paidUser = await ctx.runQuery(internal.users.getByIdInternal, {
              userId: appointment.userId,
            });
            if (paidUser) {
              await ctx.runMutation(internal.users.updateStats, {
                userId: appointment.userId,
                timesServiced: (paidUser.timesServiced || 0) + 1,
                totalSpent: (paidUser.totalSpent || 0) + invoice.total,
              });
            }
          }

          // Notify admin
          await ctx.scheduler.runAfter(
            0,
            internal.emails.sendAdminDepositPaidNotification,
            {
              appointmentId: invoice.appointmentId,
              invoiceId,
            },
          );
        } else {
          // Deposit payment flow (existing behavior)
          if (invoice.depositPaid) {
            console.log(
              `[stripe-webhook] deposit already marked paid invoiceId=${invoiceId}`,
            );
            return;
          }

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
            console.log(
              `[stripe-webhook] deposit captured invoiceId=${invoiceId} paymentIntentId=${paymentIntentId || "none"}`,
            );

            // Deposit paid — appointment stays "pending" for admin review.
            // Admin confirms manually, which triggers Stripe invoice generation.
            console.log(
              `[stripe-webhook] deposit paid, appointment stays pending for admin review appointmentId=${invoice.appointmentId}`,
            );

            // Notify admin that deposit was paid so they can confirm the appointment
            await ctx.scheduler.runAfter(
              0,
              internal.emails.sendAdminDepositPaidNotification,
              {
                appointmentId: invoice.appointmentId,
                invoiceId,
              },
            );
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

      // Handle deposit and full payments here (final payments are handled via invoice.paid)
      if (invoiceIdString && (paymentType === "deposit" || paymentType === "full")) {
        const invoiceId = invoiceIdString as Id<"invoices">;
        console.log(
          `[stripe-webhook] deposit payment_intent.succeeded invoiceId=${invoiceId} paymentIntentId=${paymentIntent.id}`,
        );
        const invoice = await ctx.runQuery(
          internal.invoices.getByIdInternal,
          {
            invoiceId,
          },
        );

        if (!invoice) {
          console.error(
            `[stripe-webhook] deposit payment intent invoice not found invoiceId=${invoiceId}`,
          );
          return;
        }

        if (paymentType === "full") {
          // Full payment backup handler
          if (invoice.status === "paid") {
            console.log(
              `[stripe-webhook] full payment already processed invoiceId=${invoiceId}`,
            );
            return;
          }

          const today = new Date().toISOString().split("T")[0];
          await ctx.runMutation(internal.invoices.updateStatusInternal, {
            invoiceId,
            status: "paid",
            paidDate: today,
          });
          await ctx.runMutation(internal.invoices.updateDepositStatusInternal, {
            invoiceId,
            depositPaid: true,
            depositPaymentIntentId: paymentIntent.id,
          });
          console.log(
            `[stripe-webhook] full payment captured via payment intent invoiceId=${invoiceId}`,
          );

          // Update user stats
          const appointment = await ctx.runQuery(
            internal.appointments.getByIdInternal,
            { appointmentId: invoice.appointmentId },
          );
          if (appointment) {
            const paidUser = await ctx.runQuery(internal.users.getByIdInternal, {
              userId: appointment.userId,
            });
            if (paidUser) {
              await ctx.runMutation(internal.users.updateStats, {
                userId: appointment.userId,
                timesServiced: (paidUser.timesServiced || 0) + 1,
                totalSpent: (paidUser.totalSpent || 0) + invoice.total,
              });
            }
          }

          // Notify admin (mirrors the primary checkout.session.completed path)
          await ctx.scheduler.runAfter(
            0,
            internal.emails.sendAdminDepositPaidNotification,
            {
              appointmentId: invoice.appointmentId,
              invoiceId,
            },
          );
        } else {
          // Deposit payment backup handler (existing behavior)
          if (invoice.depositPaid) {
            console.log(
              `[stripe-webhook] deposit payment already processed invoiceId=${invoiceId}`,
            );
            return;
          }

          if (invoice && !invoice.depositPaid) {
            await ctx.runMutation(
              internal.invoices.updateDepositStatusInternal,
              {
                invoiceId,
                depositPaid: true,
                depositPaymentIntentId: paymentIntent.id,
                status: "draft",
              },
            );
            console.log(
              `[stripe-webhook] deposit captured via payment intent invoiceId=${invoiceId}`,
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
              console.log(
                `[stripe-webhook] confirming appointment after payment_intent deposit appointmentId=${invoice.appointmentId}`,
              );
              try {
                await ctx.runMutation(
                  internal.appointments.updateStatusInternal,
                  {
                    appointmentId: invoice.appointmentId,
                    status: "confirmed",
                  },
                );
                console.log(
                  `[stripe-webhook] appointment confirmed and invoice generation scheduled appointmentId=${invoice.appointmentId}`,
                );
              } catch (error) {
                console.error(
                  `[stripe-webhook] failed to confirm appointment after payment_intent deposit appointmentId=${invoice.appointmentId}`,
                  error,
                );
                throw error;
              }
            }
          }
        }
      }
    },

    // Handle invoice payment
    "invoice.paid": async (ctx, event: Stripe.InvoicePaidEvent) => {
      const stripeInvoice = event.data.object;

      // --- Handle subscription renewal invoices ---
      const stripeSubId = (stripeInvoice as any).subscription as string | null;
      if (stripeSubId) {
        const ourSub = await ctx.runQuery(
          internal.subscriptions.getByStripeSubscriptionId,
          { stripeSubscriptionId: stripeSubId },
        );
        if (ourSub && ourSub.lastAppointmentId) {
          // Not the first payment (first is handled via checkout.session.completed)
          console.log(
            `[stripe-webhook] subscription renewal invoice.paid subscriptionId=${ourSub._id}`,
          );
          await ctx.scheduler.runAfter(0, internal.subscriptions.createNextAppointment, {
            subscriptionId: ourSub._id,
          });
          return;
        }
      }

      // Find our invoice by Stripe invoice ID
      const ourInvoice = await ctx.runQuery(
        internal.invoices.getByStripeIdInternal,
        {
          stripeInvoiceId: stripeInvoice.id,
        },
      );

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

      // --- Handle subscription payment failure ---
      const stripeSubId = (invoice as any).subscription as string | null;
      if (stripeSubId) {
        const ourSub = await ctx.runQuery(
          internal.subscriptions.getByStripeSubscriptionId,
          { stripeSubscriptionId: stripeSubId },
        );
        if (ourSub) {
          console.log(
            `[stripe-webhook] subscription payment failed subscriptionId=${ourSub._id}`,
          );
          await ctx.runMutation(internal.subscriptions.updateStatus, {
            subscriptionId: ourSub._id,
            status: "past_due",
          });
          return;
        }
      }

      // Find our invoice by Stripe invoice ID
      const ourInvoice = await ctx.runQuery(
        internal.invoices.getByStripeIdInternal,
        {
          stripeInvoiceId: invoice.id,
        },
      );

      if (ourInvoice) {
        console.log(`Payment failed for our invoice ${ourInvoice._id}`);
      }
    },

    // Handle Stripe subscription status changes
    "customer.subscription.updated": async (
      ctx,
      event: Stripe.CustomerSubscriptionUpdatedEvent,
    ) => {
      const stripeSub = event.data.object;
      const ourSub = await ctx.runQuery(
        internal.subscriptions.getByStripeSubscriptionId,
        { stripeSubscriptionId: stripeSub.id },
      );
      if (!ourSub) return;

      if (stripeSub.status === "canceled") {
        await ctx.runMutation(internal.subscriptions.updateStatus, {
          subscriptionId: ourSub._id,
          status: "cancelled",
        });
      } else if (
        stripeSub.status === "active" &&
        ourSub.status === "past_due"
      ) {
        await ctx.runMutation(internal.subscriptions.updateStatus, {
          subscriptionId: ourSub._id,
          status: "active",
        });
      }
    },

    // Handle Stripe subscription deletion
    "customer.subscription.deleted": async (
      ctx,
      event: Stripe.CustomerSubscriptionDeletedEvent,
    ) => {
      const stripeSub = event.data.object;
      const ourSub = await ctx.runQuery(
        internal.subscriptions.getByStripeSubscriptionId,
        { stripeSubscriptionId: stripeSub.id },
      );
      if (!ourSub) return;

      await ctx.runMutation(internal.subscriptions.updateStatus, {
        subscriptionId: ourSub._id,
        status: "cancelled",
      });
    },

    // Handle invoice voided
    "invoice.voided": async (ctx, event: Stripe.InvoiceVoidedEvent) => {
      const invoice = event.data.object;

      // Find our invoice by Stripe invoice ID
      const ourInvoice = await ctx.runQuery(
        internal.invoices.getByStripeIdInternal,
        {
          stripeInvoiceId: invoice.id,
        },
      );

      if (ourInvoice) {
        // Mark as voided/overdue
        await ctx.runMutation(internal.invoices.updateStatusInternal, {
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
