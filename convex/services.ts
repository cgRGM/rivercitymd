import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import Stripe from "stripe";

// Initialize Stripe with environment variable
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY environment variable is not set. Please set it in your Convex environment.",
  );
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});

// === Categories ===

// List all service categories
export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("serviceCategories").collect();
  },
});

// Create a new service category
export const createCategory = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("standard"), v.literal("subscription")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("serviceCategories", {
      name: args.name,
      type: args.type,
    });
  },
});

// === Services ===

// Get all services, optionally joined with their category
export const listWithCategories = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();
    const categories = await ctx.db.query("serviceCategories").collect();

    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));

    return services.map((service) => ({
      ...service,
      categoryName: categoryMap.get(service.categoryId) || "Unknown",
    }));
  },
});

// List all services (simple list)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("services").collect();
  },
});

// Create a new service or subscription
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    basePriceSmall: v.optional(v.number()),
    basePriceMedium: v.optional(v.number()),
    basePriceLarge: v.optional(v.number()),
    duration: v.number(),
    categoryId: v.id("serviceCategories"),
    includedServiceIds: v.optional(v.array(v.id("services"))),
    features: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Calculate basePrice for backwards compatibility (use medium if available)
    const basePrice =
      args.basePriceMedium || args.basePriceSmall || args.basePriceLarge || 0;

    return await ctx.db.insert("services", {
      name: args.name,
      description: args.description,
      basePrice, // For backwards compatibility
      basePriceSmall: args.basePriceSmall,
      basePriceMedium: args.basePriceMedium,
      basePriceLarge: args.basePriceLarge,
      duration: args.duration,
      categoryId: args.categoryId,
      includedServiceIds: args.includedServiceIds,
      features: args.features,
      icon: args.icon,
      isActive: true,
    });
  },
});

// Update a service or subscription
export const update = mutation({
  args: {
    serviceId: v.id("services"),
    name: v.string(),
    description: v.string(),
    basePriceSmall: v.optional(v.number()),
    basePriceMedium: v.optional(v.number()),
    basePriceLarge: v.optional(v.number()),
    duration: v.number(),
    categoryId: v.id("serviceCategories"),
    includedServiceIds: v.optional(v.array(v.id("services"))),
    features: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { serviceId, ...updates } = args;

    // Calculate basePrice for backwards compatibility
    const basePrice =
      updates.basePriceMedium ||
      updates.basePriceSmall ||
      updates.basePriceLarge ||
      0;

    await ctx.db.patch(serviceId, {
      ...updates,
      basePrice, // For backwards compatibility
    });
    return serviceId;
  },
});

// Delete a service
export const deleteService = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if service is being used in any appointments
    const appointments = await ctx.db.query("appointments").collect();
    const isUsed = appointments.some(
      (apt) =>
        apt.serviceIds.includes(args.serviceId) && apt.status !== "cancelled",
    );

    if (isUsed) {
      throw new Error("Cannot delete service that is currently booked");
    }

    await ctx.db.delete(args.serviceId);
    return { success: true };
  },
});

// Get services with booking statistics and popularity
export const listWithBookingStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const services = await ctx.db.query("services").collect();
    const categories = await ctx.db.query("serviceCategories").collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));

    // Get this month's appointments
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const appointments = await ctx.db.query("appointments").collect();
    const thisMonth = appointments.filter(
      (a) => new Date(a.scheduledDate) >= firstDayOfMonth,
    );

    return services.map((service) => {
      const bookingCount = thisMonth.filter((a) =>
        a.serviceIds.includes(service._id),
      ).length;

      let popularity = "Low";
      if (bookingCount > 50) popularity = "Very High";
      else if (bookingCount > 30) popularity = "High";
      else if (bookingCount > 10) popularity = "Medium";

      return {
        ...service,
        categoryName: categoryMap.get(service.categoryId) || "Unknown",
        bookings: bookingCount,
        popularity,
      };
    });
  },
});

// === Stripe Product Management ===

// Create Stripe product for service
export const createStripeProduct = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");

    // Create Stripe product
    const product = await stripe.products.create({
      name: service.name,
      description: service.description,
      metadata: {
        serviceId: args.serviceId,
        categoryId: service.categoryId,
      },
    });

    // Update service with Stripe product ID
    await ctx.db.patch(args.serviceId, {
      stripeProductId: product.id,
    });

    return product.id;
  },
});

// Update Stripe product when service changes
export const updateStripeProduct = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");
    if (!service.stripeProductId)
      throw new Error("Service has no Stripe product");

    // Update Stripe product
    await stripe.products.update(service.stripeProductId, {
      name: service.name,
      description: service.description,
      active: service.isActive,
    });

    return service.stripeProductId;
  },
});

// Get service by ID (for edit form)
export const getById = query({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.get(args.serviceId);
  },
});
