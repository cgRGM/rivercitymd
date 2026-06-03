import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { calculateTravelFeeForMiles } from "./lib/travelFees";
import schema from "./schema";
import { modules, stripeFetchMock } from "./test.setup";

describe("travelFees", () => {
  afterEach(() => {
    vi.stubGlobal("fetch", vi.fn(stripeFetchMock));
  });

  test("adds $40 for each distance band after 25 miles", () => {
    expect(calculateTravelFeeForMiles(24.9)).toBe(0);
    expect(calculateTravelFeeForMiles(25)).toBe(40);
    expect(calculateTravelFeeForMiles(49.9)).toBe(40);
    expect(calculateTravelFeeForMiles(50)).toBe(80);
    expect(calculateTravelFeeForMiles(99.9)).toBe(80);
    expect(calculateTravelFeeForMiles(100)).toBe(120);
    expect(calculateTravelFeeForMiles(150)).toBe(160);
  });

  test("calculates route distance with Radar and returns the matching fee", async () => {
    const t = convexTest(schema, modules);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url).includes("/geocode/forward")) {
          return Response.json({
            addresses: [{ latitude: 34.75, longitude: -92.3 }],
          });
        }
        if (String(url).includes("/route/distance")) {
          return Response.json({
            routes: { car: { distance: { text: "100 mi", value: 100 } } },
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const result = await t.action(api.travelFees.calculate, {
      address: {
        street: "100 Far Away Rd",
        city: "Somewhere",
        state: "AR",
        zip: "72000",
      },
    });

    expect(result).toEqual({ distanceMiles: 100, fee: 120 });
  });
});
