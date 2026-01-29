import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getUserIdFromIdentity, requireAdmin } from "./auth";
import { components } from "./_generated/api";

// Get all invoices
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.status) {
      return await ctx.db
        .query("invoices")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }

    return await ctx.db.query("invoices").collect();
  },
});

// Get a single invoice by ID
export const getById = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.get(args.invoiceId);
  },
});

// Get invoice by Stripe invoice ID (for webhooks)
export const getByStripeId = query({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .filter((q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();
  },
});

// Get invoice by appointment ID
export const getByAppointment = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_appointment", (q) =>
        q.eq("appointmentId", args.appointmentId),
      )
      .first();
  },
});

// Internal query to get invoice by ID (no auth required, for internal actions)
export const getByIdInternal = internalQuery({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args): Promise<Doc<"invoices"> | null> => {
    return await ctx.db.get(args.invoiceId);
  },
});

// Get invoice count
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    return { count: invoices.length };
  },
});

// Create invoice
export const create = mutation({
  args: {
    appointmentId: v.id("appointments"),
    userId: v.id("users"),
    invoiceNumber: v.string(),
    items: v.array(
      v.object({
        serviceId: v.id("services"),
        serviceName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        totalPrice: v.number(),
      }),
    ),
    subtotal: v.number(),
    tax: v.number(),
    total: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
    ),
    dueDate: v.string(),
    stripeInvoiceId: v.optional(v.string()),
    stripeInvoiceUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    depositAmount: v.optional(v.number()),
    depositPaid: v.optional(v.boolean()),
    depositPaymentIntentId: v.optional(v.string()),
    remainingBalance: v.optional(v.number()),
    finalPaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invoices", args);
  },
});

// Delete an invoice
export const deleteInvoice = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invoice = await ctx.db.get(args.id);
    if (invoice && invoice.status === "paid") {
      throw new Error("Cannot delete a paid invoice.");
    }

    await ctx.db.delete(args.id);
  },
});

// Update invoice status
export const updateStatus = mutation({
  args: {
    invoiceId: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
    ),
    paidDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const updateData: any = { status: args.status };
    if (args.status === "paid") {
      updateData.paidDate =
        args.paidDate || new Date().toISOString().split("T")[0];
    }

    await ctx.db.patch(args.invoiceId, updateData);
    return args.invoiceId;
  },
});

// Internal mutation to update invoice status (for use by webhook handlers)
export const updateStatusInternal = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
    ),
    paidDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updateData: any = { status: args.status };
    if (args.status === "paid") {
      updateData.paidDate =
        args.paidDate || new Date().toISOString().split("T")[0];
    }

    await ctx.db.patch(args.invoiceId, updateData);
    return args.invoiceId;
  },
});

// Update deposit status
export const updateDepositStatus = mutation({
  args: {
    invoiceId: v.id("invoices"),
    depositPaid: v.boolean(),
    depositPaymentIntentId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const updateData: any = {
      depositPaid: args.depositPaid,
    };

    if (args.depositPaymentIntentId) {
      updateData.depositPaymentIntentId = args.depositPaymentIntentId;
    }

    if (args.status) {
      updateData.status = args.status;
    }

    await ctx.db.patch(args.invoiceId, updateData);
    return args.invoiceId;
  },
});

// Internal mutation to update deposit status (for use by webhook handlers)
export const updateDepositStatusInternal = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    depositPaid: v.boolean(),
    depositPaymentIntentId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const updateData: any = {
      depositPaid: args.depositPaid,
    };

    if (args.depositPaymentIntentId) {
      updateData.depositPaymentIntentId = args.depositPaymentIntentId;
    }

    if (args.status) {
      updateData.status = args.status;
    }

    await ctx.db.patch(args.invoiceId, updateData);
    return args.invoiceId;
  },
});

// Update final payment intent ID
export const updateFinalPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
    finalPaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.invoiceId, {
      finalPaymentIntentId: args.finalPaymentIntentId,
    });
    return args.invoiceId;
  },
});

// Internal mutation to update final payment intent ID (for use by webhook handlers)
export const updateFinalPaymentInternal = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    finalPaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      finalPaymentIntentId: args.finalPaymentIntentId,
    });
    return args.invoiceId;
  },
});

// Internal mutation to update Stripe invoice data (for use by internal actions)
export const updateStripeInvoiceData = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    stripeInvoiceId: v.string(),
    stripeInvoiceUrl: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      stripeInvoiceId: args.stripeInvoiceId,
      stripeInvoiceUrl: args.stripeInvoiceUrl,
      status: args.status,
    });
    return args.invoiceId;
  },
});

// Get invoices with full details (customer name, service name, etc.) - Admin only
export const listWithDetails = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let invoices = await ctx.db.query("invoices").collect();

    if (args.status) {
      invoices = invoices.filter((i) => i.status === args.status);
    }

    const enrichedInvoices = await Promise.all(
      invoices.map(async (invoice) => {
        const user = await ctx.db.get(invoice.userId);

        return {
          ...invoice,
          customer: user?.name || "Unknown",
          customerEmail: user?.email || "",
          serviceName: invoice.items[0]?.serviceName || "Service",
          paymentMethod: "Credit Card", // TODO: Add to schema when available
        };
      }),
    );

    return enrichedInvoices.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  },
});

// Get count of unpaid invoices with deposit paid (for customer)
export const getUnpaidInvoicesCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) return 0;

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return invoices.filter(
      (invoice) =>
        invoice.status !== "paid" &&
        invoice.depositPaid === true &&
        invoice.remainingBalance &&
        invoice.remainingBalance > 0,
    ).length;
  },
});

// Get count of unpaid invoices (admin only)
export const getUnpaidInvoicesCountAdmin = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const invoices = await ctx.db
      .query("invoices")
      .filter((q) => q.neq(q.field("status"), "paid"))
      .collect();

    return invoices.length;
  },
});

// Get Stripe invoices from component (admin only)
// This provides the source of truth for payment data
// Note: The component's listInvoices requires stripeCustomerId, so we'd need to
// query all customers first. For now, use listWithDetails which shows custom invoices.
// TODO: Enhance this to query Stripe invoices by iterating through customers
export const getStripeInvoices = query({
  args: {
    stripeCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // If customer ID provided, get invoices for that customer
    if (args.stripeCustomerId) {
      return await ctx.runQuery(
        components.stripe.public.listInvoices,
        { stripeCustomerId: args.stripeCustomerId },
      );
    }

    // For now, return empty array - admin can use listWithDetails for custom invoices
    // TODO: Query all customers and aggregate their invoices
    return [];
  },
});

// Get invoices for the current user
export const getUserInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Enrich with appointment details
    const enrichedInvoices = await Promise.all(
      invoices.map(async (invoice) => {
        const appointment = await ctx.db.get(invoice.appointmentId);
        const services = appointment
          ? await Promise.all(
              appointment.serviceIds.map((id) => ctx.db.get(id)),
            )
          : [];

        return {
          ...invoice,
          appointment: appointment
            ? {
                ...appointment,
                services: services.filter((s) => s !== null),
              }
            : null,
        };
      }),
    );

    return enrichedInvoices.sort((a, b) => b._creationTime - a._creationTime);
  },
});

// Get summary statistics for invoices (admin only)
export const getSummaryStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const invoices = await ctx.db.query("invoices").collect();

    const totalRevenue = invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.total, 0);

    const pending = invoices
      .filter((i) => i.status === "sent" || i.status === "draft")
      .reduce((sum, i) => sum + i.total, 0);

    const completed = invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.total, 0);

    return {
      totalRevenue,
      pending,
      completed,
    };
  },
});
