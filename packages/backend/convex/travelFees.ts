import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  calculateTravelBufferMinutesForMiles,
  calculateTravelFeeForMiles,
  calculateHaversineDistance,
  type TravelFeeSettings,
} from "./lib/travelFees";
import { assertRateLimit, normalizeRateLimitKey } from "./rateLimiter";

const addressValidator = v.object({
  street: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  notes: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
});

function roundMiles(value: number) {
  return Math.round(value * 10) / 10;
}

async function geocodeAddress(address: string, radarSecretKey: string) {
  const response = await fetch(
    `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}&limit=1&country=US`,
    {
      headers: { Authorization: radarSecretKey },
    },
  );
  if (!response.ok) {
    throw new ConvexError({
      code: "RADAR_GEOCODE_FAILED",
      message: "We could not validate the service address. Please select it again.",
    });
  }
  const payload: any = await response.json();
  const result = payload.addresses?.[0];
  if (!result?.latitude || !result?.longitude) {
    throw new ConvexError({
      code: "RADAR_GEOCODE_EMPTY",
      message: "We could not validate the service address. Please select it again.",
    });
  }
  return {
    latitude: result.latitude as number,
    longitude: result.longitude as number,
  };
}

export const calculate = action({
  args: {
    address: addressValidator,
  },
  returns: v.object({
    distanceMiles: v.number(),
    fee: v.number(),
    bufferMinutes: v.number(),
  }),
  handler: async (ctx, args) => {
    const addressKey = normalizeRateLimitKey(
      [
        args.address.street,
        args.address.city,
        args.address.state,
        args.address.zip,
        args.address.latitude,
        args.address.longitude,
      ]
        .filter((value) => value !== undefined && value !== "")
        .join("|"),
    );
    await assertRateLimit(ctx, "travelFeeGlobal", {
      message: "Travel fee estimates are temporarily busy. Please try again shortly.",
    });
    await assertRateLimit(ctx, "travelFeeByAddress", {
      key: addressKey,
      message: "Please wait a moment before recalculating this address.",
    });

    let lat = args.address.latitude;
    let lng = args.address.longitude;

    if (lat === undefined || lng === undefined) {
      const radarSecretKey = process.env.RADAR_SECRET_KEY;
      if (!radarSecretKey) {
        throw new ConvexError({
          code: "MISSING_RADAR_SECRET_KEY",
          message: "Travel distance calculation is temporarily unavailable.",
        });
      }

      const destinationAddress = [
        args.address.street,
        args.address.city,
        args.address.state,
        args.address.zip,
      ]
        .filter(Boolean)
        .join(", ");

      const destCoords = await geocodeAddress(destinationAddress, radarSecretKey);
      lat = destCoords.latitude;
      lng = destCoords.longitude;
    }

    const settings: TravelFeeSettings = await ctx.runQuery(
      internal.travelFeeSettings.getInternal,
      {},
    );
    const distanceMiles = roundMiles(
      calculateHaversineDistance(
        settings.originLatitude,
        settings.originLongitude,
        lat,
        lng,
      ),
    );

    return {
      distanceMiles,
      fee: calculateTravelFeeForMiles(distanceMiles, settings),
      bufferMinutes: calculateTravelBufferMinutesForMiles(distanceMiles, settings),
    };
  },
});
