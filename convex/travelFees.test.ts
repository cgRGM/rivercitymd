import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import {
  calculateHaversineDistance,
  calculateTravelBufferMinutesForMiles,
  calculateTravelFeeForMiles,
} from "./lib/travelFees";
import schema from "./schema";
import { modules, stripeFetchMock } from "./test.setup";

describe("travelFees", () => {
  afterEach(() => {
    vi.stubGlobal("fetch", vi.fn(stripeFetchMock));
  });

  test("uses tiered fees for estimated travel distance", () => {
    expect(calculateTravelFeeForMiles(24.9)).toBe(0);
    expect(calculateTravelFeeForMiles(25)).toBe(30);
    expect(calculateTravelFeeForMiles(35)).toBe(30);
    expect(calculateTravelFeeForMiles(35.1)).toBe(50);
    expect(calculateTravelFeeForMiles(50)).toBe(50);
    expect(calculateTravelFeeForMiles(50.1)).toBe(50.08);
    expect(calculateTravelFeeForMiles(100)).toBe(87.5);
  });

  test("uses travel buffers for appointment blocking", () => {
    expect(calculateTravelBufferMinutesForMiles(24.9)).toBe(0);
    expect(calculateTravelBufferMinutesForMiles(25)).toBe(30);
    expect(calculateTravelBufferMinutesForMiles(35)).toBe(30);
    expect(calculateTravelBufferMinutesForMiles(35.1)).toBe(60);
    expect(calculateTravelBufferMinutesForMiles(50)).toBe(60);
    expect(calculateTravelBufferMinutesForMiles(50.1)).toBe(60);
  });

  test("calculates haversine distance in miles", () => {
    const distance = calculateHaversineDistance(
      34.752258,
      -92.329768,
      35.752258,
      -92.329768,
    );

    expect(distance).toBeGreaterThan(68);
    expect(distance).toBeLessThan(70);
  });

  test("uses passed coordinates before geocoding", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = vi.fn(stripeFetchMock);
    vi.stubGlobal("fetch", fetchMock);

    const result = await t.action(api.travelFees.calculate, {
      address: {
        street: "100 Far Away Rd",
        city: "Somewhere",
        state: "AR",
        zip: "72000",
        latitude: 35.752258,
        longitude: -92.329768,
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.distanceMiles).toBeGreaterThan(68);
    expect(result.distanceMiles).toBeLessThan(70);
    expect(result.fee).toBe(calculateTravelFeeForMiles(result.distanceMiles));
  });

  test("falls back to Radar geocoding when coordinates are missing", async () => {
    const previousKey = process.env.RADAR_SECRET_KEY;
    process.env.RADAR_SECRET_KEY = "test_radar_key";
    const t = convexTest(schema, modules);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url).includes("/geocode/forward")) {
          return Response.json({
            addresses: [{ latitude: 34.752258, longitude: -92.329768 }],
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const result = await t.action(api.travelFees.calculate, {
      address: {
        street: "220 N Tyler St",
        city: "Little Rock",
        state: "AR",
        zip: "72205",
      },
    });

    process.env.RADAR_SECRET_KEY = previousKey;
    expect(result).toEqual({ distanceMiles: 0, fee: 0 });
  });
});
