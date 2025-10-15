import { query, mutation } from "./_generated/server";
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

// Generate invoice from appointment
export const generateFromAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
    dueDate: v.string(),
    tax: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    const services = await Promise.all(
      appointment.serviceIds.map((id) => ctx.db.get(id)),
    );
    const validServices = services.filter((s) => s !== null);

    const invoiceCount = (await ctx.db.query("invoices").collect()).length;
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;

    const items = validServices.map((service) => ({
      serviceId: service!._id,
      serviceName: service!.name,
      quantity: 1,
      unitPrice: service!.basePrice,
      totalPrice: service!.basePrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = args.tax || 0;
    const total = subtotal + tax;

    return await ctx.db.insert("invoices", {
      appointmentId: args.appointmentId,
      userId: appointment.userId,
      invoiceNumber,
      items,
      subtotal,
      tax,
      total,
      status: "draft",
      dueDate: args.dueDate,
      notes: args.notes,
    });
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
