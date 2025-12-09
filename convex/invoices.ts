import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invoices", args);
  },
});

// Delete an invoice
export const deleteInvoice = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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

// Get invoices with full details (customer name, service name, etc.)
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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

// Get invoices for the current user
export const getUserInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
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

// Get summary statistics for invoices
export const getSummaryStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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
