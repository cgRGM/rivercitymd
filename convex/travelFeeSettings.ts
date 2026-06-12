import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import {
  defaultTravelFeeSettings,
  normalizeTravelFeeSettings,
  travelFeeSettingsValidator,
} from "./lib/travelFees";

export const get = query({
  args: {},
  returns: travelFeeSettingsValidator,
  handler: async (ctx) => {
    const settings = await ctx.db.query("travelFeeSettings").first();
    return normalizeTravelFeeSettings(settings ?? defaultTravelFeeSettings);
  },
});

export const getInternal = internalQuery({
  args: {},
  returns: travelFeeSettingsValidator,
  handler: async (ctx) => {
    const settings = await ctx.db.query("travelFeeSettings").first();
    return normalizeTravelFeeSettings(settings ?? defaultTravelFeeSettings);
  },
});

export const upsert = mutation({
  args: {
    freeRadiusMiles: v.number(),
    midRangeMaxMiles: v.number(),
    longRangeMaxMiles: v.number(),
    midRangeFee: v.number(),
    longRangeFee: v.number(),
    perMileRateAfterLongRange: v.number(),
    midRangeBufferMinutes: v.number(),
    longRangeBufferMinutes: v.number(),
    isActive: v.boolean(),
  },
  returns: v.id("travelFeeSettings"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.query("travelFeeSettings").first();
    const settings = normalizeTravelFeeSettings(args);

    if (existing) {
      await ctx.db.patch(existing._id, settings);
      return existing._id;
    }

    return await ctx.db.insert("travelFeeSettings", settings);
  },
});
