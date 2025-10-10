import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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
    basePrice: v.number(),
    duration: v.number(),
    categoryId: v.id("serviceCategories"),
    includedServiceIds: v.optional(v.array(v.id("services"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("services", {
      name: args.name,
      description: args.description,
      basePrice: args.basePrice,
      duration: args.duration,
      categoryId: args.categoryId,
      includedServiceIds: args.includedServiceIds,
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
    basePrice: v.number(),
    duration: v.number(),
    categoryId: v.id("serviceCategories"),
    includedServiceIds: v.optional(v.array(v.id("services"))),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { serviceId, ...updates } = args;

    await ctx.db.patch(serviceId, updates);
    return serviceId;
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
