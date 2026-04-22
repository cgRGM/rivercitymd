import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { DEFAULT_PET_FEE_AMOUNT } from "./lib/pricing";

const petFeeSettingsValidator = v.object({
  basePriceSmall: v.number(),
  basePriceMedium: v.number(),
  basePriceLarge: v.number(),
  isActive: v.boolean(),
});

const defaultPetFeeSettings = {
  basePriceSmall: DEFAULT_PET_FEE_AMOUNT,
  basePriceMedium: DEFAULT_PET_FEE_AMOUNT,
  basePriceLarge: DEFAULT_PET_FEE_AMOUNT,
  isActive: true,
};

export const get = query({
  args: {},
  returns: petFeeSettingsValidator,
  handler: async (ctx) => {
    const settings = await ctx.db.query("petFeeSettings").first();
    return settings ?? defaultPetFeeSettings;
  },
});

export const getInternal = internalQuery({
  args: {},
  returns: petFeeSettingsValidator,
  handler: async (ctx) => {
    const settings = await ctx.db.query("petFeeSettings").first();
    return settings ?? defaultPetFeeSettings;
  },
});

export const upsert = mutation({
  args: {
    basePriceSmall: v.number(),
    basePriceMedium: v.number(),
    basePriceLarge: v.number(),
    isActive: v.boolean(),
  },
  returns: v.id("petFeeSettings"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.query("petFeeSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("petFeeSettings", args);
  },
});
