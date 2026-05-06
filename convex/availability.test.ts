import { convexTest } from "convex-test";
import { expect, test, describe, beforeAll } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const SUNDAY = "2024-12-01";
const MONDAY = "2024-12-02";
const TUESDAY = "2024-12-03";

async function insertAvailabilityForDay(
  t: any,
  args: { dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean },
) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("availability", {
      dayOfWeek: args.dayOfWeek,
      startTime: args.startTime,
      endTime: args.endTime,
      isActive: args.isActive ?? true,
    });
  });
}

async function insertActiveService(t: any) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("services", {
      name: "Wash",
      description: "Wash",
      basePrice: 50,
      basePriceSmall: 45,
      basePriceMedium: 50,
      basePriceLarge: 55,
      duration: 60,
      serviceType: "standard",
      isActive: true,
    });
  });
}

describe("availability", () => {
  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  test("time block overlapping a candidate slot makes the slot unavailable", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("availability", {
        dayOfWeek: 1, // Monday
        startTime: "09:00",
        endTime: "17:00",
        isActive: true,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("timeBlocks", {
        date: MONDAY,
        startTime: "10:00",
        endTime: "12:00",
        reason: "Lunch break",
        type: "time_off",
        createdBy: adminId,
      });
    });

    const slots = await t.query(api.availability.getAvailableTimeSlots, {
      date: MONDAY,
      serviceDuration: 60,
    });

    const blockedSlots = slots.filter(
      (s: (typeof slots)[number]) =>
        !s.available && s.reason === "Time slot already booked",
    );
    expect(blockedSlots.length).toBeGreaterThan(0);

    const overlappingSlot = slots.find((s: (typeof slots)[number]) => s.time === "10:00");
    expect(overlappingSlot).toBeDefined();
    expect(overlappingSlot?.available).toBe(false);
    expect(overlappingSlot?.reason).toBe("Time slot already booked");
  });

  test("time block outside slot window leaves slots available", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("availability", {
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
        isActive: true,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("timeBlocks", {
        date: MONDAY,
        startTime: "07:00",
        endTime: "09:00",
        reason: "Before open",
        type: "other",
        createdBy: adminId,
      });
    });

    const slots = await t.query(api.availability.getAvailableTimeSlots, {
      date: MONDAY,
      serviceDuration: 60,
    });

    const availableSlots = slots.filter((s: (typeof slots)[number]) => s.available);
    expect(availableSlots.length).toBeGreaterThan(0);
    const firstSlot = slots[0];
    expect(firstSlot.time).toBe("09:00");
    expect(firstSlot.available).toBe(true);
  });

  test("existing appointment enforces 2-hour minimum spacing between starts", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Client",
        email: "client@test.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const serviceId = await insertActiveService(t);

    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2020,
        make: "Toyota",
        model: "Camry",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("availability", {
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
        isActive: true,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [vehicleId],
        serviceIds: [serviceId],
        scheduledDate: MONDAY,
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main",
          city: "City",
          state: "AR",
          zip: "72001",
        },
        status: "confirmed",
        totalPrice: 50,
        createdBy: adminId,
      });
    });

    const slots = await t.query(api.availability.getAvailableTimeSlots, {
      date: MONDAY,
      serviceDuration: 60,
    });

    const bookedReasonSlots = slots.filter(
      (s: (typeof slots)[number]) => !s.available && s.reason === "Time slot already booked",
    );
    expect(bookedReasonSlots.length).toBeGreaterThan(0);

    const tenSlot = slots.find((s: (typeof slots)[number]) => s.time === "10:00");
    expect(tenSlot?.available).toBe(false);
    expect(tenSlot?.reason).toBe("Time slot already booked");

    const nineSlot = slots.find((s: (typeof slots)[number]) => s.time === "09:00");
    expect(nineSlot?.available).toBe(false);
    expect(nineSlot?.reason).toBe("Time slot already booked");

    const elevenFifteenSlot = slots.find((s: (typeof slots)[number]) => s.time === "11:15");
    expect(elevenFifteenSlot?.available).toBe(false);
    expect(elevenFifteenSlot?.reason).toBe("Time slot already booked");

    const twelveSlot = slots.find((s: (typeof slots)[number]) => s.time === "12:00");
    expect(twelveSlot?.available).toBe(true);
  });

  test("next bookable date skips closed days", async () => {
    const t = convexTest(schema, modules);

    await insertAvailabilityForDay(t, {
      dayOfWeek: 1, // Monday
      startTime: "09:00",
      endTime: "17:00",
    });

    const nextBookableDate = await t.query(api.availability.getNextBookableDate, {
      fromDate: SUNDAY,
      horizonDays: 7,
    });
    expect(nextBookableDate).toBe(MONDAY);
  });

  test("next bookable date skips days where all slots are blocked", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-blocked@test.com",
        role: "admin",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    await insertAvailabilityForDay(t, {
      dayOfWeek: 1, // Monday
      startTime: "09:00",
      endTime: "17:00",
    });
    await insertAvailabilityForDay(t, {
      dayOfWeek: 2, // Tuesday
      startTime: "09:00",
      endTime: "17:00",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("timeBlocks", {
        date: MONDAY,
        startTime: "09:00",
        endTime: "17:00",
        reason: "Out all day",
        type: "time_off",
        createdBy: adminId,
      });
    });

    const nextBookableDate = await t.query(api.availability.getNextBookableDate, {
      fromDate: MONDAY,
      horizonDays: 7,
    });
    expect(nextBookableDate).toBe(TUESDAY);
  });

  test("appointments shorter than 120 minutes still block a full 2-hour window", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Client",
        email: "short-apt@test.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-short-apt@test.com",
        role: "admin",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const serviceId = await insertActiveService(t);

    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2021,
        make: "Toyota",
        model: "Corolla",
      });
    });

    await insertAvailabilityForDay(t, {
      dayOfWeek: 1, // Monday
      startTime: "06:00",
      endTime: "17:00",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [vehicleId],
        serviceIds: [serviceId],
        scheduledDate: MONDAY,
        scheduledTime: "07:00",
        duration: 30,
        location: {
          street: "123 Main",
          city: "City",
          state: "AR",
          zip: "72001",
        },
        status: "confirmed",
        totalPrice: 50,
        createdBy: adminId,
      });
    });

    const blocked = await t.query(api.availability.checkAvailability, {
      date: MONDAY,
      startTime: "08:45",
      duration: 120,
    });
    expect(blocked.available).toBe(false);
    expect(blocked.reason).toBe("Time slot already booked");

    const earliestAllowed = await t.query(api.availability.checkAvailability, {
      date: MONDAY,
      startTime: "09:00",
      duration: 120,
    });
    expect(earliestAllowed.available).toBe(true);
  });
});
