import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("services", () => {
  test("create and list services", async () => {
    const t = convexTest(schema, modules);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });

    // Create service category
    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Wash Services",
      type: "standard",
    });

    // Create service
    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Basic Wash",
      description: "Basic exterior wash service",
      basePriceSmall: 20,
      basePriceMedium: 25,
      basePriceLarge: 30,
      duration: 30,
      categoryId,
    });

    // Wait for scheduled functions (createStripeProduct) to complete
    await t.finishInProgressScheduledFunctions();

    expect(serviceId).toBeDefined();

    // List services
    const services = await t.query(api.services.list, {});
    expect(services.length).toBe(1);
    expect(services[0]).toMatchObject({
      name: "Basic Wash",
      description: "Basic exterior wash service",
      duration: 30,
    });
  });

  test("update service", async () => {
    const t = convexTest(schema, modules);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });

    // Create service category
    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Update Test Category",
      type: "standard",
    });

    // Create service
    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Original Service",
      description: "Original description",
      basePriceSmall: 20,
      basePriceMedium: 25,
      basePriceLarge: 30,
      duration: 30,
      categoryId,
    });

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    // Update service
    await asAdmin.mutation(api.services.update, {
      serviceId,
      name: "Updated Service",
      description: "Updated description",
      basePriceSmall: 30,
      basePriceMedium: 35,
      basePriceLarge: 40,
      duration: 45,
      categoryId,
      isActive: true,
    });

    // Verify update
    const services = await t.query(api.services.list, {});
    expect(services[0]).toMatchObject({
      name: "Updated Service",
      description: "Updated description",
      duration: 45,
      isActive: true,
    });
  });

  test("can update service", async () => {
    const t = convexTest(schema, modules);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });

    // Create service category
    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Interior Services",
      type: "standard",
    });

    // Create service
    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Interior Clean",
      description: "Basic interior cleaning",
      basePriceSmall: 35,
      basePriceMedium: 40,
      basePriceLarge: 45,
      duration: 60,
      categoryId,
    });

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    // Update service
    await asAdmin.mutation(api.services.update, {
      serviceId,
      name: "Premium Interior Detail",
      description: "Complete interior detailing service",
      basePriceSmall: 70,
      basePriceMedium: 75,
      basePriceLarge: 80,
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
    const t = convexTest(schema, modules);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });

    // Create service category
    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Test Services",
      type: "standard",
    });

    // Create service
    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Test Service",
      description: "Service for testing",
      basePriceSmall: 8,
      basePriceMedium: 10,
      basePriceLarge: 12,
      duration: 15,
      categoryId,
    });

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    // Delete service
    const result = await asAdmin.mutation(api.services.deleteService, {
      serviceId,
    });

    expect(result).toEqual({ success: true });

    // Verify deletion
    const services = await t.query(api.services.list, {});
    expect(services.length).toBe(0);
  });

  test("cannot delete service that is booked - duplicate", async () => {
    const t = convexTest(schema, modules);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });

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
      basePriceSmall: 90,
      basePriceMedium: 100,
      basePriceLarge: 110,
      duration: 120,
      categoryId,
    });

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

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

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    // Try to delete service - should fail
    await expect(
      asAdmin.mutation(api.services.deleteService, {
        serviceId,
      }),
    ).rejects.toThrow("Cannot delete service that is currently booked");
  });
});
