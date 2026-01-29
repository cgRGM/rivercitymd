import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { api, internal } from "./_generated/api";

// Get deposit settings
export const get = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("depositSettings"),
      _creationTime: v.number(), // System field
      amountPerVehicle: v.number(),
      stripeProductId: v.optional(v.string()),
      stripePriceId: v.optional(v.string()),
      isActive: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("depositSettings").first();
  },
});

// Internal query to get deposit settings (no auth required, for internal actions)
export const getInternal = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("depositSettings"),
      _creationTime: v.number(), // System field
      amountPerVehicle: v.number(),
      stripeProductId: v.optional(v.string()),
      stripePriceId: v.optional(v.string()),
      isActive: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("depositSettings").first();
  },
});

// Create or update deposit settings
export const upsert = mutation({
  args: {
    amountPerVehicle: v.number(),
  },
  returns: v.id("depositSettings"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.query("depositSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        amountPerVehicle: args.amountPerVehicle,
      });
      // Schedule Stripe product update
      await ctx.scheduler.runAfter(0, api.depositSettings.updateStripeProduct, {
        settingsId: existing._id,
      });
      return existing._id;
    } else {
      const settingsId = await ctx.db.insert("depositSettings", {
        amountPerVehicle: args.amountPerVehicle,
        isActive: true,
      });
      // Schedule Stripe product creation
      await ctx.scheduler.runAfter(0, api.depositSettings.createStripeProduct, {
        settingsId,
      });
      return settingsId;
    }
  },
});

// Create Stripe product for deposit
export const createStripeProduct = action({
  args: {
    settingsId: v.id("depositSettings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await ctx.runQuery(api.depositSettings.get, {});
    if (!settings) throw new Error("Deposit settings not found");

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      // No-op when Stripe key is missing (e.g. test env) to avoid writes after test transaction
      console.warn("STRIPE_SECRET_KEY not set, skipping deposit createStripeProduct");
      return null;
    }

    // Create Stripe product
    const productResponse = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        name: "Appointment Deposit",
        description: `Deposit per vehicle for appointment booking`,
        "metadata[type]": "deposit",
      }),
    });

    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      throw new Error(
        `Stripe product creation failed: ${productResponse.status} ${errorText}`,
      );
    }

    const product = await productResponse.json();

    // Create price
    const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: Math.round(settings.amountPerVehicle * 100).toString(),
        currency: "usd",
        "metadata[type]": "deposit",
      }),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      throw new Error(
        `Stripe price creation failed: ${priceResponse.status} ${errorText}`,
      );
    }

    const price = await priceResponse.json();

    // Update settings with Stripe IDs
    await ctx.runMutation(internal.depositSettings.updateStripeIds, {
      settingsId: args.settingsId,
      stripeProductId: product.id,
      stripePriceId: price.id,
    });

    return null;
  },
});

// Update Stripe product for deposit
export const updateStripeProduct = action({
  args: {
    settingsId: v.id("depositSettings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await ctx.runQuery(api.depositSettings.get, {});
    if (!settings) throw new Error("Deposit settings not found");
    if (!settings.stripeProductId) {
      // Create if doesn't exist
      await ctx.runAction(api.depositSettings.createStripeProduct, {
        settingsId: args.settingsId,
      });
      return null;
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    // Update product
    await fetch(`https://api.stripe.com/v1/products/${settings.stripeProductId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        name: "Appointment Deposit",
        description: `Deposit per vehicle for appointment booking`,
      }),
    });

    // Update price if amount changed
    if (settings.stripePriceId) {
      // Create new price (Stripe prices are immutable)
      const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          product: settings.stripeProductId,
          unit_amount: Math.round(settings.amountPerVehicle * 100).toString(),
          currency: "usd",
          "metadata[type]": "deposit",
        }),
      });

      if (priceResponse.ok) {
        const newPrice = await priceResponse.json();
        await ctx.runMutation(internal.depositSettings.updateStripeIds, {
          settingsId: args.settingsId,
          stripeProductId: settings.stripeProductId,
          stripePriceId: newPrice.id,
        });
      }
    }

    return null;
  },
});

// Internal mutation to update Stripe IDs
export const updateStripeIds = internalMutation({
  args: {
    settingsId: v.id("depositSettings"),
    stripeProductId: v.string(),
    stripePriceId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.settingsId, {
      stripeProductId: args.stripeProductId,
      stripePriceId: args.stripePriceId,
    });
  },
});

