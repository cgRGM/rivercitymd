import { convexTest } from "convex-test";
import { expect, test, describe, beforeAll } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

// 2024-12-02 is Monday (dayOfWeek 1) in UTC; set TZ so getDay() is consistent
const TEST_DATE = "2024-12-02";

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
        date: TEST_DATE,
        startTime: "10:00",
        endTime: "12:00",
        reason: "Lunch break",
        type: "time_off",
        createdBy: adminId,
      });
    });

    const slots = await t.query(api.availability.getAvailableTimeSlots, {
      date: TEST_DATE,
      serviceDuration: 60,
    });

    const blockedSlots = slots.filter(
      (s) => !s.available && s.reason?.startsWith("Blocked:"),
    );
    expect(blockedSlots.length).toBeGreaterThan(0);
    expect(blockedSlots[0].reason).toContain("Lunch break");

    const overlappingSlot = slots.find((s) => s.time === "10:00");
    expect(overlappingSlot).toBeDefined();
    expect(overlappingSlot?.available).toBe(false);
    expect(overlappingSlot?.reason).toContain("Blocked:");
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
        date: TEST_DATE,
        startTime: "07:00",
        endTime: "09:00",
        reason: "Before open",
        type: "other",
        createdBy: adminId,
      });
    });

    const slots = await t.query(api.availability.getAvailableTimeSlots, {
      date: TEST_DATE,
      serviceDuration: 60,
    });

    const availableSlots = slots.filter((s) => s.available);
    expect(availableSlots.length).toBeGreaterThan(0);
    const firstSlot = slots[0];
    expect(firstSlot.time).toBe("09:00");
    expect(firstSlot.available).toBe(true);
  });

  test("existing appointment with 2-hour block makes overlapping slots unavailable", async () => {
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

    const categoryId = await t.run(async (ctx) => {
      return await ctx.db.insert("serviceCategories", {
        name: "Wash",
        type: "standard",
      });
    });

    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Wash",
        description: "Wash",
        basePrice: 50,
        duration: 60,
        categoryId,
        isActive: true,
      });
    });

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
        scheduledDate: TEST_DATE,
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
      date: TEST_DATE,
      serviceDuration: 60,
    });

    const bookedReasonSlots = slots.filter(
      (s) => !s.available && s.reason === "Time slot already booked",
    );
    expect(bookedReasonSlots.length).toBeGreaterThan(0);

    const tenSlot = slots.find((s) => s.time === "10:00");
    expect(tenSlot?.available).toBe(false);
    expect(tenSlot?.reason).toBe("Time slot already booked");

    const nineSlot = slots.find((s) => s.time === "09:00");
    expect(nineSlot?.available).toBe(false);
    expect(nineSlot?.reason).toBe("Time slot already booked");

    const elevenFifteenSlot = slots.find((s) => s.time === "11:15");
    expect(elevenFifteenSlot?.available).toBe(true);
  });
});
