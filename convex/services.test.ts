import { convexTest } from "convex-test";
import { expect, test, describe, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { seedBookingSetup } from "./testUtils/bookingSetup";

async function expectConvexErrorCode(
  promise: Promise<unknown>,
  expectedCode: string,
) {
  try {
    await promise;
    throw new Error("Expected mutation to throw");
  } catch (error: any) {
    const errorCode = error?.data?.code ?? String(error?.message ?? "");
    expect(String(errorCode)).toContain(expectedCode);
  }
}

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

  test("can hide and unhide service via update", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-visibility@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-visibility@test.com",
    });

    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Visibility Category",
      type: "standard",
    });

    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Visibility Service",
      description: "Toggle visibility test",
      basePriceSmall: 20,
      basePriceMedium: 25,
      basePriceLarge: 30,
      duration: 45,
      categoryId,
    });

    await asAdmin.mutation(api.services.update, {
      serviceId,
      name: "Visibility Service",
      description: "Toggle visibility test",
      basePriceSmall: 20,
      basePriceMedium: 25,
      basePriceLarge: 30,
      duration: 45,
      categoryId,
      isActive: false,
    });

    let services = await t.query(api.services.list, {});
    expect(services[0]?.isActive).toBe(false);

    await asAdmin.mutation(api.services.update, {
      serviceId,
      name: "Visibility Service",
      description: "Toggle visibility test",
      basePriceSmall: 20,
      basePriceMedium: 25,
      basePriceLarge: 30,
      duration: 45,
      categoryId,
      isActive: true,
    });

    services = await t.query(api.services.list, {});
    expect(services[0]?.isActive).toBe(true);
  });

  test("update does not call fetch in mutation when service has stripeProductId", async () => {
    const t = convexTest(schema, modules);
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_key";

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-stripe-sync@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-stripe-sync@test.com",
    });

    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Stripe Sync Service",
        description: "Ensures visibility changes sync Stripe asynchronously",
        basePrice: 25,
        basePriceSmall: 20,
        basePriceMedium: 25,
        basePriceLarge: 30,
        duration: 45,
        isActive: true,
        stripeProductId: "prod_visibility_sync_test",
      });
    });

    const previousFetch = globalThis.fetch;

    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("fetch should not be called from mutation context");
        }),
      );

      await asAdmin.mutation(api.services.update, {
        serviceId,
        name: "Stripe Sync Service",
        description: "Ensures visibility changes sync Stripe asynchronously",
        basePriceSmall: 20,
        basePriceMedium: 25,
        basePriceLarge: 30,
        duration: 45,
        isActive: false,
      });

      await asAdmin.mutation(api.services.update, {
        serviceId,
        name: "Stripe Sync Service",
        description: "Ensures visibility changes sync Stripe asynchronously",
        basePriceSmall: 20,
        basePriceMedium: 25,
        basePriceLarge: 30,
        duration: 45,
        isActive: true,
      });
    } finally {
      vi.stubGlobal("fetch", previousFetch as typeof globalThis.fetch);
    }

    const service = await asAdmin.query(api.services.getById, { serviceId });
    expect(service?.isActive).toBe(true);
  });

  test("create rejects services with zero pricing across all sizes", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-zero-create@test.com",
        role: "admin",
      });
    });
    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-zero-create@test.com",
    });

    await expectConvexErrorCode(
      asAdmin.mutation(api.services.create, {
        name: "Broken Pricing",
        description: "Invalid zero-price service",
        basePriceSmall: 0,
        basePriceMedium: 0,
        basePriceLarge: 0,
        duration: 45,
      }),
      "INVALID_SERVICE_PRICING",
    );
  });

  test("update rejects services when pricing is set to zero across all sizes", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-zero-update@test.com",
        role: "admin",
      });
    });
    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-zero-update@test.com",
    });

    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Valid Service",
      description: "Starts valid",
      basePriceSmall: 25,
      basePriceMedium: 30,
      basePriceLarge: 35,
      duration: 45,
    });

    await expectConvexErrorCode(
      asAdmin.mutation(api.services.update, {
        serviceId,
        name: "Now Invalid",
        description: "No valid prices",
        basePriceSmall: 0,
        basePriceMedium: 0,
        basePriceLarge: 0,
        duration: 45,
        isActive: true,
      }),
      "INVALID_SERVICE_PRICING",
    );
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

  test("non-admin cannot call privileged service mutations", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-guard@test.com",
        role: "admin",
      });
    });
    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Client",
        email: "client-guard@test.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin-guard@test.com" });
    const asClient = t.withIdentity({
      subject: clientId,
      email: "client-guard@test.com",
    });

    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Guard Category",
      type: "standard",
    });

    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Guard Service",
      description: "Admin-only mutation guard test",
      basePriceSmall: 40,
      basePriceMedium: 50,
      basePriceLarge: 60,
      duration: 45,
      categoryId,
    });

    await expect(
      asClient.mutation(api.services.createCategory, {
        name: "Blocked Category",
        type: "standard",
      }),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.services.create, {
        name: "Blocked Create",
        description: "Should fail",
        basePriceSmall: 10,
        basePriceMedium: 15,
        basePriceLarge: 20,
        duration: 30,
      }),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.services.update, {
        serviceId,
        name: "Blocked Update",
        description: "Should fail",
        basePriceSmall: 45,
        basePriceMedium: 55,
        basePriceLarge: 65,
        duration: 50,
        categoryId,
        isActive: true,
      }),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.services.deleteService, { serviceId }),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.services.updateStripeProduct, { serviceId }),
    ).rejects.toThrow("Admin access required");
  });

  test("cannot delete service with appointment history", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t);

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
    ).rejects.toThrow("Cannot delete service with appointment history. Hide it instead.");
  });

  test("cannot delete service with cancelled appointment history", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-cancelled@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-cancelled@test.com",
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Customer",
        email: "customer-cancelled@test.com",
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
        make: "Honda",
        model: "Pilot",
        color: "Blue",
      });
    });

    const categoryId = await asAdmin.mutation(api.services.createCategory, {
      name: "Cancel History Services",
      type: "standard",
    });

    const serviceId = await asAdmin.mutation(api.services.create, {
      name: "Cancel History Detail",
      description: "Service used in cancelled appointment",
      basePriceSmall: 70,
      basePriceMedium: 80,
      basePriceLarge: 90,
      duration: 90,
      categoryId,
    });

    await t.finishInProgressScheduledFunctions();

    const { appointmentId } = await asAdmin.mutation(api.appointments.create, {
      userId,
      vehicleIds: [vehicleId],
      serviceIds: [serviceId],
      scheduledDate: "2024-12-07",
      scheduledTime: "10:00",
      street: "200 Cancel Rd",
      city: "Springfield",
      state: "IL",
      zip: "62704",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(appointmentId, { status: "cancelled" });
    });

    await expect(
      asAdmin.mutation(api.services.deleteService, {
        serviceId,
      }),
    ).rejects.toThrow("Cannot delete service with appointment history. Hide it instead.");
  });
});
