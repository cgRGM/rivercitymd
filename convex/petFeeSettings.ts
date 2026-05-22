import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { DEFAULT_PET_FEE_TIME_MINUTES } from "./lib/booking";
import { DEFAULT_PET_FEE_AMOUNT } from "./lib/pricing";

const petFeeSettingsValidator = v.object({
  basePriceSmall: v.number(),
  basePriceMedium: v.number(),
  basePriceLarge: v.number(),
  timeAddMinutes: v.optional(v.number()),
  isActive: v.boolean(),
});

const defaultPetFeeSettings = {
  basePriceSmall: DEFAULT_PET_FEE_AMOUNT,
  basePriceMedium: DEFAULT_PET_FEE_AMOUNT,
  basePriceLarge: DEFAULT_PET_FEE_AMOUNT,
  timeAddMinutes: DEFAULT_PET_FEE_TIME_MINUTES,
  isActive: true,
};

function normalizeTimeAddMinutes(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_PET_FEE_TIME_MINUTES;
  }

  return Math.max(0, Math.floor(value));
}

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
    timeAddMinutes: v.optional(v.number()),
    isActive: v.boolean(),
  },
  returns: v.id("petFeeSettings"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.query("petFeeSettings").first();
    const settings = {
      ...args,
      timeAddMinutes: normalizeTimeAddMinutes(args.timeAddMinutes),
    };

    if (existing) {
      await ctx.db.patch(existing._id, settings);
      return existing._id;
    }

    return await ctx.db.insert("petFeeSettings", settings);
  },
});
