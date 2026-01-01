import {
  query,
  mutation,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity } from "./auth";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

// Get count of pending appointments (admin only)
export const getPendingCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(userId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

    const appointments = await ctx.db
      .query("appointments")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return appointments.length;
  },
});

// Get all appointments
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("rescheduled"),
      ),
    ),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    let appointmentsQuery;
    if (args.date) {
      appointmentsQuery = ctx.db
        .query("appointments")
        .withIndex("by_date", (q) => q.eq("scheduledDate", args.date!));
    } else {
      appointmentsQuery = ctx.db.query("appointments");
    }

    if (args.status) {
      return (await appointmentsQuery.collect()).filter(
        (apt) => apt.status === args.status,
      );
    }

    return await appointmentsQuery.collect();
  },
});

// Get a single appointment by ID
export const getById = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.get(args.appointmentId);
  },
});

// Internal query to get appointment by ID (no auth required, for internal actions)
export const getByIdInternal = internalQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args): Promise<Doc<"appointments"> | null> => {
    return await ctx.db.get(args.appointmentId);
  },
});

// Get appointments for a specific user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await getUserIdFromIdentity(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own appointments, admins can see all
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Create appointment
export const create = mutation({
  args: {
    userId: v.id("users"),
    vehicleIds: v.array(v.id("vehicles")),
    serviceIds: v.array(v.id("services")),
    scheduledDate: v.string(),
    scheduledTime: v.string(),
    street: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    locationNotes: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    appointmentId: v.id("appointments"),
    invoiceId: v.id("invoices"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    appointmentId: Id<"appointments">;
    invoiceId: Id<"invoices">;
  }> => {
    const authUserId = await getUserIdFromIdentity(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    const services = await Promise.all(
      args.serviceIds.map((id) => ctx.db.get(id)),
    );
    const validServices = services.filter((s) => s !== null);
    if (validServices.length !== args.serviceIds.length) {
      throw new Error("One or more services not found");
    }

    // Get vehicle sizes to calculate proper pricing
    const vehicles = await Promise.all(
      args.vehicleIds.map((id) => ctx.db.get(id)),
    );
    const validVehicles = vehicles.filter((v) => v !== null);

    const totalPrice =
      validServices.reduce((sum, service) => {
        // Use the first vehicle's size for pricing (assuming uniform pricing)
        const vehicleSize = validVehicles[0]?.size || "medium";
        let price = service!.basePriceMedium || service!.basePrice || 0;

        if (vehicleSize === "small") {
          price =
            service!.basePriceSmall ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        } else if (vehicleSize === "large") {
          price =
            service!.basePriceLarge ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        }

        return sum + price;
      }, 0) * args.vehicleIds.length;
    const duration = validServices.reduce(
      (sum, service) => sum + (service!.duration || 0),
      0,
    );

    const appointmentId: Id<"appointments"> = await ctx.db.insert(
      "appointments",
      {
        userId: args.userId,
        vehicleIds: args.vehicleIds,
        serviceIds: args.serviceIds,
        scheduledDate: args.scheduledDate,
        scheduledTime: args.scheduledTime,
        duration,
        location: {
          street: args.street,
          city: args.city,
          state: args.state,
          zip: args.zip,
          notes: args.locationNotes,
        },
        status: "pending",
        totalPrice,
        notes: args.notes,
        createdBy: authUserId,
      },
    );

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Note: User stats (timesServiced, totalSpent) should be updated when appointment is completed,
    // not when appointment is created. This is handled in the appointment completion flow.

    // Calculate invoice items
    const vehicleSize = validVehicles[0]?.size || "medium";
    const items = validServices.map((service) => {
      // Calculate the correct price based on vehicle size
      let unitPrice = service!.basePriceMedium || service!.basePrice || 0;
      if (vehicleSize === "small") {
        unitPrice =
          service!.basePriceSmall ||
          service!.basePriceMedium ||
          service!.basePrice ||
          0;
      } else if (vehicleSize === "large") {
        unitPrice =
          service!.basePriceLarge ||
          service!.basePriceMedium ||
          service!.basePrice ||
          0;
      }

      return {
        serviceId: service!._id,
        serviceName: service!.name,
        quantity: args.vehicleIds.length,
        unitPrice,
        totalPrice: unitPrice * args.vehicleIds.length,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = 0;
    const total = subtotal + tax;

    // Get deposit amount from settings (default $50 per vehicle)
    // Use internal query since this is called from a mutation
    const depositSettings = await ctx.runQuery(
      internal.depositSettings.getInternal,
      {},
    );
    const depositPerVehicle = depositSettings?.amountPerVehicle ?? 50;
    const calculatedDepositAmount = depositPerVehicle * args.vehicleIds.length;
    // Cap deposit at total to prevent negative remaining balance
    const depositAmount = Math.min(calculatedDepositAmount, total);
    const remainingBalance = Math.max(0, total - depositAmount);

    // Generate invoice number
    const invoiceCountResult = await ctx.runQuery(api.invoices.getCount, {});
    const invoiceCount: number = invoiceCountResult.count;
    const invoiceNumber: string = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;

    // Create invoice date
    const appointmentDate = new Date(args.scheduledDate);
    const dueDate = new Date(appointmentDate);
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice in Convex immediately (don't create Stripe invoice yet - wait for deposit)
    const invoiceId: Id<"invoices"> = await ctx.db.insert("invoices", {
      appointmentId,
      userId: args.userId,
      invoiceNumber,
      items,
      subtotal,
      tax,
      total,
      status: "draft", // Start as draft, will be sent after deposit is paid
      dueDate: dueDate.toISOString().split("T")[0],
      notes: `Invoice for appointment on ${args.scheduledDate}`,
      depositAmount,
      depositPaid: false,
      remainingBalance,
    });

    // Ensure Stripe customer exists (schedule action to create if needed)
    // This is critical for deposit checkout to work
    await ctx.scheduler.runAfter(0, internal.users.ensureStripeCustomer, {
      userId: args.userId,
    });

    // Return both appointmentId and invoiceId so frontend can redirect to checkout
    return { appointmentId, invoiceId };
  },
});

// Update appointment
export const update = mutation({
  args: {
    appointmentId: v.id("appointments"),
    userId: v.id("users"),
    vehicleIds: v.array(v.id("vehicles")),
    serviceIds: v.array(v.id("services")),
    scheduledDate: v.string(),
    scheduledTime: v.string(),
    street: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    locationNotes: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { appointmentId, ...updates } = args;

    const services = await Promise.all(
      updates.serviceIds.map((id) => ctx.db.get(id)),
    );
    const validServices = services.filter((s) => s !== null);
    if (validServices.length !== updates.serviceIds.length) {
      throw new Error("One or more services not found");
    }

    // Get vehicle sizes to calculate proper pricing
    const vehicles = await Promise.all(
      updates.vehicleIds.map((id) => ctx.db.get(id)),
    );
    const validVehicles = vehicles.filter((v) => v !== null);

    const totalPrice =
      validServices.reduce((sum, service) => {
        const vehicleSize = validVehicles[0]?.size || "medium";
        let price = service!.basePriceMedium || service!.basePrice || 0;

        if (vehicleSize === "small") {
          price =
            service!.basePriceSmall ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        } else if (vehicleSize === "large") {
          price =
            service!.basePriceLarge ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        }

        return sum + price;
      }, 0) * updates.vehicleIds.length;
    const duration = validServices.reduce(
      (sum, service) => sum + (service!.duration || 0),
      0,
    );

    await ctx.db.patch(appointmentId, {
      userId: updates.userId,
      vehicleIds: updates.vehicleIds,
      serviceIds: updates.serviceIds,
      scheduledDate: updates.scheduledDate,
      scheduledTime: updates.scheduledTime,
      duration,
      location: {
        street: updates.street,
        city: updates.city,
        state: updates.state,
        zip: updates.zip,
        notes: updates.locationNotes,
      },
      totalPrice,
      notes: updates.notes,
    });

    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentId))
      .unique();

    if (invoice) {
      const items = validServices.map((service) => {
        const vehicleSize = validVehicles[0]?.size || "medium";
        let unitPrice = service!.basePriceMedium || service!.basePrice || 0;

        if (vehicleSize === "small") {
          unitPrice =
            service!.basePriceSmall ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        } else if (vehicleSize === "large") {
          unitPrice =
            service!.basePriceLarge ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        }

        return {
          serviceId: service!._id,
          serviceName: service!.name,
          quantity: updates.vehicleIds.length,
          unitPrice,
          totalPrice: unitPrice * updates.vehicleIds.length,
        };
      });

      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const total = subtotal + invoice.tax;

      await ctx.db.patch(invoice._id, {
        items,
        subtotal,
        total,
      });
    }

    return appointmentId;
  },
});

// Delete an appointment
export const deleteAppointment = mutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_appointment", (q) =>
        q.eq("appointmentId", args.appointmentId),
      )
      .unique();

    if (invoice && invoice.status !== "paid") {
      await ctx.db.delete(invoice._id);
    }

    await ctx.db.delete(args.appointmentId);
  },
});

// Update appointment status
export const updateStatus = mutation({
  args: {
    appointmentId: v.id("appointments"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    const user = await ctx.db.get(appointment.userId);
    if (!user) throw new Error("User not found");

    if (args.status === "cancelled" && appointment.status !== "cancelled") {
      await ctx.db.patch(user._id, {
        cancellationCount: (user.cancellationCount || 0) + 1,
      });
    } else if (
      args.status !== "cancelled" &&
      appointment.status === "cancelled"
    ) {
      await ctx.db.patch(user._id, {
        cancellationCount: Math.max(0, (user.cancellationCount || 0) - 1),
      });
    }

    const oldStatus = appointment.status;
    await ctx.db.patch(args.appointmentId, { status: args.status });

    // When confirming an appointment with paid deposit, generate and send invoice
    if (args.status === "confirmed" && oldStatus !== "confirmed") {
      // Get invoice for this appointment
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_appointment", (q) =>
          q.eq("appointmentId", args.appointmentId),
        )
        .first();

      if (invoice && invoice.depositPaid && invoice.status === "draft") {
        // Schedule invoice generation and sending
        await ctx.scheduler.runAfter(
          0,
          internal.appointments.generateAndSendInvoice,
          {
            appointmentId: args.appointmentId,
            invoiceId: invoice._id,
          },
        );
      }
    }

    // Schedule final payment charge when status changes to "completed"
    if (args.status === "completed" && oldStatus !== "completed") {
      // Get invoice for this appointment
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_appointment", (q) =>
          q.eq("appointmentId", args.appointmentId),
        )
        .first();

      if (
        invoice &&
        invoice.depositPaid &&
        invoice.remainingBalance &&
        invoice.remainingBalance > 0 &&
        invoice.status !== "paid"
      ) {
        // Schedule final payment charge action
        await ctx.scheduler.runAfter(
          0,
          internal.appointments.chargeFinalPayment,
          {
            appointmentId: args.appointmentId,
            invoiceId: invoice._id,
          },
        );
      }
    }

    return args.appointmentId;
  },
});

// Internal mutation to update appointment status (for use by webhook handlers)
export const updateStatusInternal = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    const user = await ctx.db.get(appointment.userId);
    if (!user) throw new Error("User not found");

    if (args.status === "cancelled" && appointment.status !== "cancelled") {
      await ctx.db.patch(user._id, {
        cancellationCount: (user.cancellationCount || 0) + 1,
      });
    } else if (
      args.status !== "cancelled" &&
      appointment.status === "cancelled"
    ) {
      await ctx.db.patch(user._id, {
        cancellationCount: Math.max(0, (user.cancellationCount || 0) - 1),
      });
    }

    const oldStatus = appointment.status;
    await ctx.db.patch(args.appointmentId, { status: args.status });

    // When confirming an appointment with paid deposit, generate and send invoice
    if (args.status === "confirmed" && oldStatus !== "confirmed") {
      // Get invoice for this appointment
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_appointment", (q) =>
          q.eq("appointmentId", args.appointmentId),
        )
        .first();

      if (invoice && invoice.depositPaid && invoice.status === "draft") {
        // Schedule invoice generation and sending
        await ctx.scheduler.runAfter(
          0,
          internal.appointments.generateAndSendInvoice,
          {
            appointmentId: args.appointmentId,
            invoiceId: invoice._id,
          },
        );
      }
    }

    return args.appointmentId;
  },
});

// Reschedule appointment
export const reschedule = mutation({
  args: {
    appointmentId: v.id("appointments"),
    newDate: v.string(),
    newTime: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.appointmentId, {
      scheduledDate: args.newDate,
      scheduledTime: args.newTime,
      status: "confirmed",
    });

    return args.appointmentId;
  },
});

// Get calendar view
export const getCalendarView = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const appointments = await ctx.db.query("appointments").collect();

    return appointments.filter(
      (apt) =>
        apt.scheduledDate >= args.startDate &&
        apt.scheduledDate <= args.endDate &&
        apt.status !== "cancelled",
    );
  },
});

// Get upcoming appointments
export const getUpcoming = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("appointments"),
      _creationTime: v.number(),
      userId: v.id("users"),
      userName: v.optional(v.string()), // Customer name
      vehicleIds: v.array(v.id("vehicles")),
      serviceIds: v.array(v.id("services")),
      scheduledDate: v.string(),
      scheduledTime: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("rescheduled"),
      ),
      totalPrice: v.number(),
      duration: v.number(),
      location: v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        zip: v.string(),
        notes: v.optional(v.string()),
      }),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split("T")[0];
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    const appointments = await ctx.db.query("appointments").collect();

    // Enrich appointments with customer names
    const enrichedAppointments = await Promise.all(
      appointments
        .filter(
          (apt) =>
            apt.scheduledDate >= todayStr &&
            apt.scheduledDate <= nextWeekStr &&
            apt.status !== "cancelled",
        )
        .map(async (apt) => {
          const user = await ctx.db.get(apt.userId);
          return {
            ...apt,
            userName: user?.name || undefined,
          };
        }),
    );

    return enrichedAppointments.sort((a, b) => {
      if (a.scheduledDate === b.scheduledDate) {
        return a.scheduledTime.localeCompare(b.scheduledTime);
      }
      return a.scheduledDate.localeCompare(b.scheduledDate);
    });
  },
});

// Get user's appointments separated by upcoming and past
export const getUserAppointments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Join with services and vehicles
    const enrichedAppointments = await Promise.all(
      appointments.map(async (apt) => {
        const services = await Promise.all(
          apt.serviceIds.map((id) => ctx.db.get(id)),
        );
        const vehicles = await Promise.all(
          apt.vehicleIds.map((id) => ctx.db.get(id)),
        );

        return {
          ...apt,
          services: services.filter((s) => s !== null),
          vehicles: vehicles.filter((v) => v !== null),
        };
      }),
    );

    // Separate upcoming and past
    const upcoming = enrichedAppointments
      .filter(
        (apt) =>
          apt.scheduledDate >= todayStr &&
          apt.status !== "cancelled" &&
          apt.status !== "completed",
      )
      .sort((a, b) => {
        if (a.scheduledDate === b.scheduledDate) {
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        return a.scheduledDate.localeCompare(b.scheduledDate);
      });

    const past = enrichedAppointments
      .filter(
        (apt) =>
          apt.scheduledDate < todayStr ||
          apt.status === "completed" ||
          apt.status === "cancelled",
      )
      .sort((a, b) => {
        if (a.scheduledDate === b.scheduledDate) {
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        return b.scheduledDate.localeCompare(a.scheduledDate);
      });

    return { upcoming, past };
  },
});

// Action to create Stripe invoice and Convex invoice record for an appointment
export const createStripeInvoice = action({
  args: {
    appointmentId: v.id("appointments"),
    userId: v.id("users"),
    services: v.array(
      v.object({
        _id: v.id("services"),
        stripePriceIds: v.array(v.string()),
        basePriceSmall: v.optional(v.number()),
        basePriceMedium: v.optional(v.number()),
        basePriceLarge: v.optional(v.number()),
        name: v.string(),
      }),
    ),
    vehicles: v.array(
      v.object({
        size: v.optional(
          v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
        ),
      }),
    ),
    totalPrice: v.number(),
    scheduledDate: v.string(),
    invoiceId: v.optional(v.id("invoices")), // Optional: if provided, update existing invoice instead of creating new one
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    // Get user data
    const user = await ctx.runQuery(api.users.getById, {
      userId: args.userId,
    });
    if (!user) throw new Error("User not found");

    // Update user stats (we'll do this via a mutation call)
    // Note: User stats are updated in the appointment creation

    // Check if user has Stripe customer ID, create if not
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      // Create Stripe customer
      const customerResponse = await fetch(
        "https://api.stripe.com/v1/customers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: user.email || "",
            name: user.name || "",
            phone: user.phone || "",
            "address[line1]": user.address?.street || "",
            "address[city]": user.address?.city || "",
            "address[state]": user.address?.state || "",
            "address[postal_code]": user.address?.zip || "",
            "address[country]": "US",
          }),
        },
      );

      if (!customerResponse.ok) {
        throw new Error("Failed to create Stripe customer");
      }

      const stripeCustomer = await customerResponse.json();
      stripeCustomerId = stripeCustomer.id;

      // Update user with Stripe customer ID
      await ctx.runMutation(api.users.updateStripeCustomerId, {
        userId: args.userId,
        stripeCustomerId: stripeCustomerId!,
      });
    }

    // Create invoice items using existing Stripe price IDs from services
    const vehicleSize = args.vehicles[0]?.size || "medium";

    for (const service of args.services) {
      if (!service.stripePriceIds || service.stripePriceIds.length === 0) {
        throw new Error(`Service ${service.name} has no Stripe price IDs`);
      }

      // Find the appropriate price ID based on vehicle size
      // The stripePriceIds array contains price IDs in order: small, medium, large
      let priceIndex = 1; // Default to medium (index 1)
      if (vehicleSize === "small") priceIndex = 0;
      else if (vehicleSize === "large") priceIndex = 2;

      const stripePriceId =
        service.stripePriceIds[priceIndex] ||
        service.stripePriceIds[1] ||
        service.stripePriceIds[0];

      if (!stripePriceId) {
        throw new Error(
          `No Stripe price found for service ${service.name} and size ${vehicleSize}`,
        );
      }

      // Create invoice item
      const invoiceItemResponse = await fetch(
        "https://api.stripe.com/v1/invoiceitems",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            customer: stripeCustomerId!,
            price: stripePriceId,
            quantity: args.vehicles.length.toString(),
          }),
        },
      );

      if (!invoiceItemResponse.ok) {
        const errorText = await invoiceItemResponse.text();
        throw new Error(`Failed to create invoice item: ${errorText}`);
      }
    }

    // Create the invoice
    const appointmentDate = new Date(args.scheduledDate);
    const dueDate = new Date(appointmentDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const invoiceResponse = await fetch("https://api.stripe.com/v1/invoices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: stripeCustomerId!,
        collection_method: "send_invoice",
        days_until_due: "30",
        auto_advance: "true",
        description: `Mobile detailing service - ${args.scheduledDate}`,
      }),
    });

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      throw new Error(`Failed to create Stripe invoice: ${errorText}`);
    }

    const stripeInvoice = await invoiceResponse.json();

    // Send the invoice (Stripe will email it automatically)
    const sendResponse = await fetch(
      `https://api.stripe.com/v1/invoices/${stripeInvoice.id}/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`Failed to send Stripe invoice: ${errorText}`);
    }

    const sentInvoice = await sendResponse.json();

    // If invoiceId is provided, update existing invoice instead of creating new one
    if (args.invoiceId) {
      await ctx.runMutation(internal.invoices.updateStripeInvoiceData, {
        invoiceId: args.invoiceId,
        stripeInvoiceId: sentInvoice.id,
        stripeInvoiceUrl: sentInvoice.hosted_invoice_url,
        status: "sent",
      });
      return null;
    }

    // Otherwise, create a new invoice (for backward compatibility)
    // Generate invoice number
    const invoiceCount = (await ctx.runQuery(api.invoices.getCount, {})).count;
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;

    // Create invoice items for Convex
    const items = args.services.map((service) => {
      // Calculate the correct price based on vehicle size
      let unitPrice = service.basePriceMedium || 0;
      if (vehicleSize === "small") {
        unitPrice = service.basePriceSmall || service.basePriceMedium || 0;
      } else if (vehicleSize === "large") {
        unitPrice = service.basePriceLarge || service.basePriceMedium || 0;
      }

      return {
        serviceId: service._id,
        serviceName: service.name,
        quantity: args.vehicles.length,
        unitPrice,
        totalPrice: unitPrice * args.vehicles.length,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = 0;
    const total = subtotal + tax;

    // Store invoice in Convex with Stripe data
    await ctx.runMutation(api.invoices.create, {
      appointmentId: args.appointmentId,
      userId: args.userId,
      invoiceNumber,
      items,
      subtotal,
      tax,
      total,
      status: "sent",
      dueDate: dueDate.toISOString().split("T")[0],
      stripeInvoiceId: sentInvoice.id,
      stripeInvoiceUrl: sentInvoice.hosted_invoice_url,
      notes: `Invoice for appointment on ${args.scheduledDate}`,
    });

    return null;
  },
});

// Get appointments with full details (joined with clients, services, vehicles)
export const listWithDetails = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("rescheduled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const appointments = await ctx.db.query("appointments").collect();

    // Join with users, services, and vehicles
    const enrichedAppointments = await Promise.all(
      appointments.map(async (apt) => {
        const user = await ctx.db.get(apt.userId);
        const services = await Promise.all(
          apt.serviceIds.map((id) => ctx.db.get(id)),
        );
        const vehicles = await Promise.all(
          apt.vehicleIds.map((id) => ctx.db.get(id)),
        );

        return {
          ...apt,
          user,
          services: services.filter((s) => s !== null),
          vehicles: vehicles.filter((v) => v !== null),
        };
      }),
    );

    const filtered = args.status
      ? enrichedAppointments.filter((a) => a.status === args.status)
      : enrichedAppointments;

    return filtered.sort((a, b) => {
      if (a.scheduledDate === b.scheduledDate) {
        return a.scheduledTime.localeCompare(b.scheduledTime);
      }
      return b.scheduledDate.localeCompare(a.scheduledDate);
    });
  },
});

// === Internal Actions for Payment Processing ===

// Charge deposit when appointment is confirmed
export const chargeDeposit = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get invoice and appointment (use internal queries that don't require auth)
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.invoices.getByIdInternal,
      { invoiceId: args.invoiceId },
    );
    const appointment: Doc<"appointments"> | null = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );

    if (!invoice || !appointment) return;
    if (!invoice.depositAmount || invoice.depositPaid) return;

    // Get user
    const user: Doc<"users"> | null = await ctx.runQuery(api.users.getById, {
      userId: appointment.userId,
    });
    if (!user || !user.stripeCustomerId) {
      console.error("User not found or missing Stripe customer ID");
      return;
    }

    // Create Payment Intent for deposit
    try {
      const paymentIntent: any = await ctx.runAction(
        api.payments.createPaymentIntent,
        {
          amount: invoice.depositAmount,
          currency: "usd",
          customerId: user.stripeCustomerId,
          invoiceId: args.invoiceId,
          paymentType: "deposit",
        },
      );

      // Update invoice with payment intent ID
      await ctx.runMutation(api.invoices.updateDepositStatus, {
        invoiceId: args.invoiceId,
        depositPaid: false, // Will be updated via webhook when payment succeeds
        depositPaymentIntentId: paymentIntent.id,
        status: "sent",
      });
    } catch (error) {
      console.error("Failed to create deposit payment intent:", error);
      // Don't throw - allow appointment to be confirmed even if payment fails
    }
  },
});

// Generate and send invoice when appointment is confirmed
export const generateAndSendInvoice = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get invoice and appointment
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.invoices.getByIdInternal,
      { invoiceId: args.invoiceId },
    );
    const appointment: Doc<"appointments"> | null = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );

    if (!invoice || !appointment) return;

    // Get user
    const user: Doc<"users"> | null = await ctx.runQuery(api.users.getById, {
      userId: appointment.userId,
    });
    if (!user || !user.stripeCustomerId) {
      console.error("User not found or missing Stripe customer ID");
      return;
    }

    // Use the existing createStripeInvoice action
    const services = await Promise.all(
      appointment.serviceIds.map((id) =>
        ctx.runQuery(api.services.getById, { serviceId: id }),
      ),
    );
    const validServices = services.filter((s) => s !== null);

    // Get vehicle count from appointment (number of vehicle IDs)
    // The invoice items already have correct pricing per vehicle
    const vehicleCount = appointment.vehicleIds.length;

    // Use medium as default size - invoice items already have correct pricing per vehicle
    const vehicleSize = "medium" as const;

    await ctx.runAction(api.appointments.createStripeInvoice, {
      appointmentId: args.appointmentId,
      userId: appointment.userId,
      services: validServices.map((s) => ({
        _id: s!._id,
        stripePriceIds: s!.stripePriceIds || [],
        basePriceSmall: s!.basePriceSmall,
        basePriceMedium: s!.basePriceMedium,
        basePriceLarge: s!.basePriceLarge,
        name: s!.name,
      })),
      vehicles: Array(vehicleCount).fill({ size: vehicleSize }),
      totalPrice: invoice.total,
      scheduledDate: appointment.scheduledDate,
      invoiceId: args.invoiceId, // Pass existing invoiceId to update instead of creating new one
    });
  },
});

// Charge final payment when appointment is completed
export const chargeFinalPayment = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get invoice and appointment (use internal queries that don't require auth)
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.invoices.getByIdInternal,
      { invoiceId: args.invoiceId },
    );
    const appointment: Doc<"appointments"> | null = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );

    if (!invoice || !appointment) return;
    if (!invoice.remainingBalance || invoice.remainingBalance <= 0) return;
    if (!invoice.depositPaid) {
      console.error("Deposit not paid, cannot charge final payment");
      return;
    }

    // Get user
    const user: Doc<"users"> | null = await ctx.runQuery(api.users.getById, {
      userId: appointment.userId,
    });
    if (!user || !user.stripeCustomerId) {
      console.error("User not found or missing Stripe customer ID");
      return;
    }

    // Create Payment Intent for final payment
    try {
      const paymentIntent: any = await ctx.runAction(
        api.payments.createPaymentIntent,
        {
          amount: invoice.remainingBalance,
          currency: "usd",
          customerId: user.stripeCustomerId,
          invoiceId: args.invoiceId,
          paymentType: "final_payment",
        },
      );

      // Update invoice with final payment intent ID
      await ctx.runMutation(api.invoices.updateFinalPayment, {
        invoiceId: args.invoiceId,
        finalPaymentIntentId: paymentIntent.id,
      });

      // Note: User stats (timesServiced, totalSpent) should only be updated
      // when payment actually succeeds, not when payment intent is created.
      // This is handled in the payment_intent.succeeded webhook handler.
    } catch (error) {
      console.error("Failed to create final payment intent:", error);
      // Don't throw - allow appointment to be completed even if payment fails
    }
  },
});
