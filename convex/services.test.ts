import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("services", () => {
  test("create and list services", async () => {
    const t = convexTest(schema);
  });

  test("update service", async () => {
    const t = convexTest(schema);
  });

  test("delete service", async () => {
    const t = convexTest(schema);
  });

  test("cannot delete service that is booked", async () => {
    const t = convexTest(schema);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });

    // Create service category
    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Interior Services",
      type: "standard",
    });

    // Create service
    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Interior Clean",
      description: "Basic interior cleaning",
      basePrice: 40,
      duration: 60,
      categoryId,
    });

    // Update service
    await asAdmin.mutation(api.services.update, {
      serviceId,
      name: "Premium Interior Detail",
      description: "Complete interior detailing service",
      basePrice: 75,
      duration: 90,
      categoryId,
      isActive: true,
    });

    // Verify update
    const services = await t.query(api.services.list, {});
    expect(services[0]).toMatchObject({
      name: "Premium Interior Detail",
      description: "Complete interior detailing service",
      basePrice: 75,
      duration: 90,
      isActive: true,
    });
  });

  test("delete service", async () => {
    const t = convexTest(schema);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });

    // Create service category
    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Test Services",
      type: "standard",
    });

    // Create service
    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Test Service",
      description: "Service for testing",
      basePrice: 10,
      duration: 15,
      categoryId,
    });

    // Delete service
    const result = await asAdmin.mutation(api.services.deleteService, {
      serviceId,
    });

    expect(result).toEqual({ success: true });

    // Verify deletion
    const services = await t.query(api.services.list, {});
    expect(services.length).toBe(0);
  });

  test("cannot delete service that is booked", async () => {
    const t = convexTest(schema);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });

    // Create user and vehicle
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Customer",
        email: "customer@test.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2023,
        make: "Tesla",
        model: "Model 3",
        color: "White",
      });
    });

    // Create service category and service
    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Electric Vehicle Services",
      type: "standard",
    });

    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "EV Detail",
      description: "Specialized electric vehicle detailing",
      basePrice: 100,
      duration: 120,
      categoryId,
    });

    // Create appointment using the service
    await asAdmin.mutation(api.appointments.create, {
      userId,
      vehicleIds: [vehicleId],
      serviceIds: [serviceId],
      scheduledDate: "2024-12-05",
      scheduledTime: "13:00",
      street: "100 Electric Ave",
      city: "Springfield",
      state: "IL",
      zip: "62704",
    });

    // Try to delete service - should fail
    await expect(
      asAdmin.mutation(api.services.deleteService, {
        serviceId,
      }),
    ).rejects.toThrow("Cannot delete service that is currently booked");
  });
});
