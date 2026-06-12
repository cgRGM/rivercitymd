import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./auth";
import {
  defaultTravelFeeSettings,
  normalizeTravelFeeSettings,
  type TravelFeeSettings,
  travelFeeSettingsValidator,
} from "./lib/travelFees";

const travelFeeSettingsArgs = {
  originStreet: v.string(),
  originCity: v.string(),
  originState: v.string(),
  originZip: v.string(),
  freeRadiusMiles: v.number(),
  midRangeMaxMiles: v.number(),
  longRangeMaxMiles: v.number(),
  midRangeFee: v.number(),
  longRangeFee: v.number(),
  perMileRateAfterLongRange: v.number(),
  midRangeBufferMinutes: v.number(),
  longRangeBufferMinutes: v.number(),
  isActive: v.boolean(),
};

const travelFeeSettingsWithOriginArgs = {
  ...travelFeeSettingsArgs,
  originLatitude: v.number(),
  originLongitude: v.number(),
};

async function geocodeOriginAddress(args: {
  originStreet: string;
  originCity: string;
  originState: string;
  originZip: string;
}) {
  const radarSecretKey = process.env.RADAR_SECRET_KEY;
  if (!radarSecretKey) {
    throw new ConvexError({
      code: "MISSING_RADAR_SECRET_KEY",
      message: "Travel origin validation is temporarily unavailable.",
    });
  }

  const address = [
    args.originStreet,
    args.originCity,
    args.originState,
    args.originZip,
  ]
    .filter(Boolean)
    .join(", ");
  const response = await fetch(
    `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}&limit=1&country=US`,
    { headers: { Authorization: radarSecretKey } },
  );
  if (!response.ok) {
    throw new ConvexError({
      code: "RADAR_GEOCODE_FAILED",
      message: "We could not validate the travel origin address.",
    });
  }

  const payload: any = await response.json();
  const result = payload.addresses?.[0];
  if (!result?.latitude || !result?.longitude) {
    throw new ConvexError({
      code: "RADAR_GEOCODE_EMPTY",
      message: "We could not find coordinates for the travel origin address.",
    });
  }

  return {
    latitude: result.latitude as number,
    longitude: result.longitude as number,
  };
}

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
  args: travelFeeSettingsWithOriginArgs,
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

export const upsertInternal = internalMutation({
  args: travelFeeSettingsWithOriginArgs,
  returns: v.id("travelFeeSettings"),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("travelFeeSettings").first();
    const settings = normalizeTravelFeeSettings(args);

    if (existing) {
      await ctx.db.patch(existing._id, settings);
      return existing._id;
    }

    return await ctx.db.insert("travelFeeSettings", settings);
  },
});

export const validateOriginAndUpsert = action({
  args: travelFeeSettingsArgs,
  returns: v.id("travelFeeSettings"),
  handler: async (ctx, args): Promise<Id<"travelFeeSettings">> => {
    await requireAdmin(ctx);

    const normalized = normalizeTravelFeeSettings(args);
    const coords = await geocodeOriginAddress(normalized);
    const settings: TravelFeeSettings = {
      ...normalized,
      originLatitude: coords.latitude,
      originLongitude: coords.longitude,
    };

    return await ctx.runMutation(internal.travelFeeSettings.upsertInternal, settings);
  },
});
