import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function insertBusinessInfo(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("businessInfo", {
      name: "River City Mobile Detailing",
      owner: "Owner Name",
      address: "123 Main St",
      cityStateZip: "Little Rock, AR 72201",
      country: "USA",
    });
  });
}

async function insertAvailability(
  t: any,
  args: { startTime: string; endTime: string; isActive?: boolean } = {
    startTime: "09:00",
    endTime: "17:00",
  },
) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("availability", {
      dayOfWeek: 1,
      startTime: args.startTime,
      endTime: args.endTime,
      isActive: args.isActive ?? true,
    });
  });
}

async function insertBookableStandardService(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("services", {
      name: "Exterior Detail",
      description: "Exterior wash and detail",
      basePrice: 79,
      basePriceSmall: 69,
      basePriceMedium: 79,
      basePriceLarge: 89,
      duration: 120,
      serviceType: "standard",
      isActive: true,
    });
  });
}

describe("setupReadiness", () => {
  test("flags missing_business_info when other booking prerequisites exist", async () => {
    const t = convexTest(schema, modules);

    await insertAvailability(t);
    await insertBookableStandardService(t);

    const readiness = await t.query(api.setupReadiness.getPublicBookingReadiness, {});
    expect(readiness.isReady).toBe(false);
    expect(
      readiness.blockers.map((b: (typeof readiness.blockers)[number]) => b.code),
    ).toEqual(["missing_business_info"]);
  });

  test("flags missing_availability when business info and services exist", async () => {
    const t = convexTest(schema, modules);

    await insertBusinessInfo(t);
    await insertBookableStandardService(t);
    // Active but only 60 minutes (below 2-hour booking minimum), should still fail readiness.
    await insertAvailability(t, { startTime: "09:00", endTime: "10:00" });

    const readiness = await t.query(api.setupReadiness.getPublicBookingReadiness, {});
    expect(readiness.isReady).toBe(false);
    expect(
      readiness.blockers.map((b: (typeof readiness.blockers)[number]) => b.code),
    ).toEqual(["missing_availability"]);
  });

  test("flags missing_bookable_service_pricing when business info and availability exist", async () => {
    const t = convexTest(schema, modules);

    await insertBusinessInfo(t);
    await insertAvailability(t);

    const readiness = await t.query(api.setupReadiness.getPublicBookingReadiness, {});
    expect(readiness.isReady).toBe(false);
    expect(
      readiness.blockers.map((b: (typeof readiness.blockers)[number]) => b.code),
    ).toEqual(["missing_bookable_service_pricing"]);
  });

  test("returns ready when all booking prerequisites are configured", async () => {
    const t = convexTest(schema, modules);

    await insertBusinessInfo(t);
    await insertAvailability(t);
    await insertBookableStandardService(t);

    const readiness = await t.query(api.setupReadiness.getPublicBookingReadiness, {});
    expect(readiness.isReady).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.checks).toEqual({
      businessInfoConfigured: true,
      availabilityConfigured: true,
      bookableServicePricingConfigured: true,
    });
  });
});
