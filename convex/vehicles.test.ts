import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("vehicles", () => {
  test("prevents deleting vehicles attached to appointments", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Vehicle User",
        email: "vehicle-user@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2022,
        make: "Toyota",
        model: "Camry",
        size: "medium",
      });
    });

    const serviceCategoryId = await t.run(async (ctx) => {
      return await ctx.db.insert("serviceCategories", {
        name: "Detailing",
        type: "standard",
      });
    });

    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Full Detail",
        description: "Complete detail",
        basePrice: 100,
        duration: 120,
        categoryId: serviceCategoryId,
        isActive: true,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [vehicleId],
        serviceIds: [serviceId],
        scheduledDate: "2026-03-30",
        scheduledTime: "09:00",
        duration: 120,
        location: {
          street: "123 Main St",
          city: "Searcy",
          state: "AR",
          zip: "72143",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const asUser = t.withIdentity({
      subject: userId,
      email: "vehicle-user@example.com",
    });

    await expect(
      asUser.mutation(api.vehicles.deleteVehicle, { id: vehicleId }),
    ).rejects.toThrow("attached to an appointment");
  });

  test("repairs appointments with missing vehicle references when exactly one replacement vehicle exists", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
        status: "active",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Customer User",
        email: "customer@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const replacementVehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2024,
        make: "Honda",
        model: "Civic",
        size: "small",
      });
    });

    const staleVehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2020,
        make: "Ford",
        model: "Escape",
        size: "medium",
      });
    });

    const serviceCategoryId = await t.run(async (ctx) => {
      return await ctx.db.insert("serviceCategories", {
        name: "Detailing",
        type: "standard",
      });
    });

    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Interior Detail",
        description: "Interior detail",
        basePrice: 125,
        duration: 90,
        categoryId: serviceCategoryId,
        isActive: true,
      });
    });

    const appointmentId = await t.run(async (ctx) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [staleVehicleId],
        serviceIds: [serviceId],
        scheduledDate: "2026-03-31",
        scheduledTime: "11:00",
        duration: 90,
        location: {
          street: "123 Main St",
          city: "Searcy",
          state: "AR",
          zip: "72143",
        },
        status: "pending",
        totalPrice: 125,
        createdBy: adminId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(staleVehicleId);
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@example.com",
    });

    const result = await asAdmin.mutation(
      api.appointments.repairMissingVehicleReferences,
      { dryRun: false },
    );

    expect(result.reattachedAppointments).toBe(1);

    const repairedAppointment = await t.run(async (ctx) =>
      ctx.db.get(appointmentId),
    );
    expect(repairedAppointment?.vehicleIds).toEqual([replacementVehicleId]);
  });
});
