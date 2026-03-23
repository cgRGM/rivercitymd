import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./auth";

type WebhookLevel = "info" | "warn" | "error";
type WebhookSource = "stripe" | "clerk" | "auth";
type WebhookActionResult =
  | "linked"
  | "invited"
  | "skipped"
  | "failed"
  | "ignored";

function hasStripeEvidence(invoice: Doc<"invoices">) {
  return Boolean(
    invoice.stripeInvoiceId ||
      invoice.stripePaymentIntentId ||
      invoice.depositPaymentIntentId ||
      invoice.finalPaymentIntentId,
  );
}

function sortNewestFirst<T extends { _creationTime: number }>(records: T[]) {
  return records.sort((a, b) => b._creationTime - a._creationTime);
}

export const record = internalMutation({
  args: {
    source: v.union(
      v.literal("stripe"),
      v.literal("clerk"),
      v.literal("auth"),
    ),
    level: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("error"),
    ),
    eventType: v.string(),
    eventId: v.optional(v.string()),
    message: v.string(),
    stripeObjectId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    invoiceId: v.optional(v.id("invoices")),
    appointmentId: v.optional(v.id("appointments")),
    userId: v.optional(v.id("users")),
    clerkUserId: v.optional(v.string()),
    actionResult: v.optional(
      v.union(
        v.literal("linked"),
        v.literal("invited"),
        v.literal("skipped"),
        v.literal("failed"),
        v.literal("ignored"),
      ),
    ),
    details: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookEvents", args);
    return null;
  },
});

export const getAdminOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, invoices, appointments, webhookEvents] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("invoices").collect(),
      ctx.db.query("appointments").collect(),
      ctx.db.query("webhookEvents").collect(),
    ]);

    const userById = new Map(users.map((user) => [user._id, user]));
    const appointmentById = new Map(
      appointments.map((appointment) => [appointment._id, appointment]),
    );

    const latestGuestSyncByUser = new Map<
      Id<"users">,
      {
        level: WebhookLevel;
        actionResult?: WebhookActionResult;
        _creationTime: number;
        message: string;
      }
    >();

    for (const event of sortNewestFirst([...webhookEvents])) {
      if (
        event.userId &&
        event.source === "stripe" &&
        event.eventType === "checkout.session.completed" &&
        !latestGuestSyncByUser.has(event.userId)
      ) {
        latestGuestSyncByUser.set(event.userId, {
          level: event.level as WebhookLevel,
          actionResult: event.actionResult as WebhookActionResult | undefined,
          _creationTime: event._creationTime,
          message: event.message,
        });
      }
    }

    const paidDepositsMissingStripeInvoice = invoices
      .filter((invoice) => {
        if (!invoice.depositPaid || invoice.paymentOption !== "deposit") {
          return false;
        }
        if (invoice.stripeInvoiceId) {
          return false;
        }
        const appointment = appointmentById.get(invoice.appointmentId);
        return appointment !== undefined && appointment.status !== "pending";
      })
      .map((invoice) => {
        const appointment = appointmentById.get(invoice.appointmentId);
        const user = userById.get(invoice.userId);
        return {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          appointmentId: invoice.appointmentId,
          appointmentStatus: appointment?.status || "unknown",
          userId: invoice.userId,
          customerName: user?.name || user?.email || "Unknown customer",
          customerEmail: user?.email || "",
          invoiceGenerationError: invoice.invoiceGenerationError || null,
        };
      })
      .slice(0, 10);

    const paidGuestInvoicesMissingClerkAccount = invoices
      .filter((invoice) => invoice.depositPaid || invoice.status === "paid")
      .map((invoice) => {
        const user = userById.get(invoice.userId);
        const appointment = appointmentById.get(invoice.appointmentId);
        if (!user || user.clerkUserId || !user.email) {
          return null;
        }
        const latestSync = latestGuestSyncByUser.get(user._id);
        return {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          appointmentId: invoice.appointmentId,
          appointmentStatus: appointment?.status || "unknown",
          userId: user._id,
          customerName: user.name || user.email,
          customerEmail: user.email,
          latestSyncAt: latestSync?._creationTime || null,
          latestSyncLevel: latestSync?.level || null,
          latestSyncResult: latestSync?.actionResult || null,
          latestSyncMessage: latestSync?.message || null,
        };
      })
      .filter((record) => record !== null)
      .slice(0, 10);

    const paidInvoicesMissingStripeEvidence = invoices
      .filter((invoice) => invoice.status === "paid" && !hasStripeEvidence(invoice))
      .map((invoice) => {
        const user = userById.get(invoice.userId);
        return {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          userId: invoice.userId,
          customerName: user?.name || user?.email || "Unknown customer",
          customerEmail: user?.email || "",
        };
      })
      .slice(0, 10);

    const usersMissingStripeCustomer = users
      .filter(
        (user) =>
          user.role !== "admin" &&
          user.status !== "inactive" &&
          !user.stripeCustomerId,
      )
      .map((user) => ({
        userId: user._id,
        customerName: user.name || user.email || "Unknown user",
        customerEmail: user.email || "",
        status: user.status || "active",
        hasClerkAccount: Boolean(user.clerkUserId),
      }))
      .slice(0, 10);

    const recentIssues = sortNewestFirst(
      webhookEvents.filter(
        (event) =>
          event.level !== "info" &&
          event._creationTime > Date.now() - 7 * 24 * 60 * 60 * 1000,
      ),
    )
      .slice(0, 20)
      .map((event) => ({
        id: event._id,
        source: event.source as WebhookSource,
        level: event.level as WebhookLevel,
        eventType: event.eventType,
        eventId: event.eventId || null,
        message: event.message,
        invoiceId: event.invoiceId || null,
        appointmentId: event.appointmentId || null,
        userId: event.userId || null,
        clerkUserId: event.clerkUserId || null,
        actionResult:
          (event.actionResult as WebhookActionResult | undefined) || null,
        createdAt: event._creationTime,
      }));

    return {
      counts: {
        paidDepositsMissingStripeInvoice:
          paidDepositsMissingStripeInvoice.length,
        paidGuestInvoicesMissingClerkAccount:
          paidGuestInvoicesMissingClerkAccount.length,
        paidInvoicesMissingStripeEvidence:
          paidInvoicesMissingStripeEvidence.length,
        usersMissingStripeCustomer: usersMissingStripeCustomer.length,
        recentIssues: recentIssues.length,
      },
      paidDepositsMissingStripeInvoice,
      paidGuestInvoicesMissingClerkAccount,
      paidInvoicesMissingStripeEvidence,
      usersMissingStripeCustomer,
      recentIssues,
    };
  },
});
