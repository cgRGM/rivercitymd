import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity } from "./auth";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";

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
    type: v.union(
      v.literal("standard"),
      v.literal("subscription"),
      v.literal("addon"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("serviceCategories", {
      name: args.name,
      type: args.type,
    });
  },
});

// === Services ===

// Create Stripe product for service (action for external API calls)
export const createStripeProduct = action({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    // Get the service data
    const service = await ctx.runQuery(internal.services.getServiceById, {
      serviceId: args.serviceId,
    });

    if (!service) throw new Error("Service not found");

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      // Throw error to maintain function contract and detect configuration issues
      // In test environments, this error will be caught by test setup error handlers
      throw new Error(
        `STRIPE_SECRET_KEY environment variable is not set for service ${args.serviceId}`,
      );
    }

    // Create Stripe product using HTTP fetch (no SDK)
    const productResponse = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        name: service.name,
        description: service.description || "",
        "metadata[serviceId]": args.serviceId,
        "metadata[categoryId]": service.categoryId,
      }),
    });

    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      throw new Error(
        `Stripe product creation failed: ${productResponse.status} ${errorText}`,
      );
    }

    const product = await productResponse.json();

    // Create prices for each vehicle size
    const prices = [];

    if (service.basePriceSmall && service.basePriceSmall > 0) {
      const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          product: product.id,
          unit_amount: Math.round(service.basePriceSmall * 100).toString(),
          currency: "usd",
          "metadata[serviceId]": args.serviceId,
          "metadata[vehicleSize]": "small",
        }),
      });

      if (!priceResponse.ok) {
        const errorText = await priceResponse.text();
        throw new Error(
          `Stripe small price creation failed: ${priceResponse.status} ${errorText}`,
        );
      }

      const price = await priceResponse.json();
      prices.push(price);
    }

    if (service.basePriceMedium && service.basePriceMedium > 0) {
      const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          product: product.id,
          unit_amount: Math.round(service.basePriceMedium * 100).toString(),
          currency: "usd",
          "metadata[serviceId]": args.serviceId,
          "metadata[vehicleSize]": "medium",
        }),
      });

      if (!priceResponse.ok) {
        const errorText = await priceResponse.text();
        throw new Error(
          `Stripe medium price creation failed: ${priceResponse.status} ${errorText}`,
        );
      }

      const price = await priceResponse.json();
      prices.push(price);
    }

    if (service.basePriceLarge && service.basePriceLarge > 0) {
      const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          product: product.id,
          unit_amount: Math.round(service.basePriceLarge * 100).toString(),
          currency: "usd",
          "metadata[serviceId]": args.serviceId,
          "metadata[vehicleSize]": "large",
        }),
      });

      if (!priceResponse.ok) {
        const errorText = await priceResponse.text();
        throw new Error(
          `Stripe large price creation failed: ${priceResponse.status} ${errorText}`,
        );
      }

      const price = await priceResponse.json();
      prices.push(price);
    }

    // Update service with Stripe product ID and price IDs
    // Note: Deposit is now a separate product managed via depositSettings
    await ctx.runMutation(internal.services.updateStripeIds, {
      serviceId: args.serviceId,
      stripeProductId: product.id,
      stripePriceIds: prices.map((p) => p.id),
    });
  },
});

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
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Calculate basePrice for backwards compatibility (use medium if available)
    const basePrice =
      args.basePriceMedium || args.basePriceSmall || args.basePriceLarge || 0;

    // Create the service in the database
    // Note: Deposit is now a separate product managed via depositSettings
    const serviceId = await ctx.db.insert("services", {
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

    // Schedule Stripe product creation (async, external API)
    await ctx.scheduler.runAfter(0, api.services.createStripeProduct, {
      serviceId,
    });

    return serviceId;
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
    const userId = await getUserIdFromIdentity(ctx);
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
    const userId = await getUserIdFromIdentity(ctx);
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

// Update Stripe product when service changes
export const updateStripeProduct = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");
    if (!service.stripeProductId)
      throw new Error("Service has no Stripe product");

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    // Update Stripe product using HTTP
    const updateResponse = await fetch(
      `https://api.stripe.com/v1/products/${service.stripeProductId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          name: service.name,
          description: service.description || "",
          active: service.isActive ? "true" : "false",
        }),
      },
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(
        `Stripe product update failed: ${updateResponse.status} ${errorText}`,
      );
    }

    return service.stripeProductId;
  },
});

// Get service by ID (for edit form)
export const getById = query({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.get(args.serviceId);
  },
});

// Get service by ID (internal)
export const getServiceById = internalQuery({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.serviceId);
  },
});

// Update Stripe IDs (internal)
export const updateStripeIds = internalMutation({
  args: {
    serviceId: v.id("services"),
    stripeProductId: v.string(),
    stripePriceIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serviceId, {
      stripeProductId: args.stripeProductId,
      stripePriceIds: args.stripePriceIds,
    });
  },
});
