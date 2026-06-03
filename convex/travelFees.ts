import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { calculateTravelFeeForMiles } from "./lib/travelFees";

const TRAVEL_ORIGIN_ADDRESS = "220 N Tyler St, Little Rock, AR 72205";

const addressValidator = v.object({
  street: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  notes: v.optional(v.string()),
});

function roundMiles(value: number) {
  return Math.round(value * 10) / 10;
}

function milesFromDistance(distance: any): number {
  if (!distance) return 0;
  if (typeof distance.text === "string") {
    const text = distance.text.toLowerCase();
    const numeric = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric)) {
      if (text.includes("mi")) return numeric;
      if (text.includes("ft")) return numeric / 5280;
      if (text.includes("km")) return numeric / 1.60934;
      if (text.includes("m")) return numeric / 1609.34;
    }
  }
  if (typeof distance.value === "number" && Number.isFinite(distance.value)) {
    return distance.value > 1000 ? distance.value / 1609.34 : distance.value;
  }
  return 0;
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
  }),
  handler: async (_ctx, args) => {
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
    const [origin, destination] = await Promise.all([
      geocodeAddress(TRAVEL_ORIGIN_ADDRESS, radarSecretKey),
      geocodeAddress(destinationAddress, radarSecretKey),
    ]);
    const routeResponse = await fetch(
      `https://api.radar.io/v1/route/distance?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&modes=car&units=imperial`,
      {
        headers: { Authorization: radarSecretKey },
      },
    );
    if (!routeResponse.ok) {
      throw new ConvexError({
        code: "RADAR_ROUTE_FAILED",
        message: "We could not calculate travel distance for this address.",
      });
    }

    const routePayload: any = await routeResponse.json();
    const route = routePayload.routes?.car || routePayload.routes?.geodesic;
    const distanceMiles = roundMiles(milesFromDistance(route?.distance));
    return {
      distanceMiles,
      fee: calculateTravelFeeForMiles(distanceMiles),
    };
  },
});
