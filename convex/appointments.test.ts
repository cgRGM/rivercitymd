import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const APPOINTMENT_TEST_DATE = "2024-12-02"; // Monday (dayOfWeek 1)

async function seedBookingSetup(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("businessInfo", {
      name: "River City Mobile Detailing",
      owner: "Owner Name",
      address: "123 Main St",
      cityStateZip: "Little Rock, AR 72201",
      country: "USA",
    });

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      await ctx.db.insert("availability", {
        dayOfWeek,
        startTime: "08:00",
        endTime: "18:00",
        isActive: true,
      });
    }
  });
}

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

describe("appointments", () => {
  test("create appointment", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t);

    // Create a user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        phone: "555-1234",
        role: "client",
        address: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    // Create a service category
    const categoryId = await t.run(async (ctx) => {
      return await ctx.db.insert("serviceCategories", {
        name: "Basic Wash",
        type: "standard",
      });
    });

    // Create a service
    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Exterior Wash",
        description: "Complete exterior wash",
        basePrice: 25,
        duration: 60,
        categoryId,
        isActive: true,
      });
    });

    // Create a vehicle
    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2020,
        make: "Toyota",
        model: "Camry",
        color: "Blue",
      });
    });

    // Create deposit settings (required for appointment creation)
    await t.run(async (ctx) => {
      await ctx.db.insert("depositSettings", {
        amountPerVehicle: 50,
        isActive: true,
      });
    });

    // Create appointment as admin
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@example.com" });

    const { appointmentId, invoiceId } = await asAdmin.mutation(api.appointments.create, {
      userId,
      vehicleIds: [vehicleId],
      serviceIds: [serviceId],
      scheduledDate: APPOINTMENT_TEST_DATE,
      scheduledTime: "10:00",
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    });

    // Wait for scheduled functions (ensureStripeCustomer) to complete
    await t.finishInProgressScheduledFunctions();

    expect(appointmentId).toBeDefined();
    expect(invoiceId).toBeDefined();

    // Verify appointment was created
    const appointment = await t.run(async (ctx) => {
      return await ctx.db.get(appointmentId);
    });

    expect(appointment).toMatchObject({
      userId,
      vehicleIds: [vehicleId],
      serviceIds: [serviceId],
      scheduledDate: APPOINTMENT_TEST_DATE,
      scheduledTime: "10:00",
      status: "pending",
      totalPrice: 25,
    });

    // Verify invoice was created
    const invoice = await t.run(async (ctx) => {
      return await ctx.db.query("invoices").first();
    });

    expect(invoice).toMatchObject({
      appointmentId,
      userId,
      status: "draft",
      subtotal: 25,
      total: 25,
    });
  });

  test("list appointments", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t);

    // Create test data
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Jane Doe",
        email: "jane@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const categoryId = await t.run(async (ctx) => {
      return await ctx.db.insert("serviceCategories", {
        name: "Detailing",
        type: "standard",
      });
    });

    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Full Detail",
        description: "Complete interior and exterior detail",
        basePrice: 150,
        duration: 180,
        categoryId,
        isActive: true,
      });
    });

    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2022,
        make: "Honda",
        model: "Civic",
        color: "Red",
      });
    });

    // Create deposit settings (required for appointment creation)
    await t.run(async (ctx) => {
      await ctx.db.insert("depositSettings", {
        amountPerVehicle: 50,
        isActive: true,
      });
    });

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });

    // Create multiple appointments
    await asAdmin.mutation(api.appointments.create, {
      userId,
      vehicleIds: [vehicleId],
      serviceIds: [serviceId],
      scheduledDate: "2024-12-01",
      scheduledTime: "09:00",
      street: "456 Oak St",
      city: "Springfield",
      state: "IL",
      zip: "62702",
    });

    await asAdmin.mutation(api.appointments.create, {
      userId,
      vehicleIds: [vehicleId],
      serviceIds: [serviceId],
      scheduledDate: "2024-12-02",
      scheduledTime: "14:00",
      street: "456 Oak St",
      city: "Springfield",
      state: "IL",
      zip: "62702",
    });

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    // Test listing appointments
    const appointments = await asAdmin.query(api.appointments.list, {});
    expect(appointments.length).toBe(2);

    // Test filtering by status
    const pendingAppointments = await asAdmin.query(api.appointments.list, {
      status: "pending",
    });
    expect(pendingAppointments.length).toBe(2);

    // Test filtering by date
    const dateAppointments = await asAdmin.query(api.appointments.list, {
      date: "2024-12-01",
    });
    expect(dateAppointments.length).toBe(1);
  });

  test("update appointment status", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t);

    // Create test data
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
        role: "client",
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
        name: "Basic Wash",
        description: "Basic exterior wash",
        basePrice: 20,
        duration: 30,
        categoryId,
        isActive: true,
      });
    });

    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2021,
        make: "Ford",
        model: "F-150",
        color: "Black",
      });
    });

    // Create deposit settings (required for appointment creation)
    await t.run(async (ctx) => {
      await ctx.db.insert("depositSettings", {
        amountPerVehicle: 50,
        isActive: true,
      });
    });

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });

    const { appointmentId } = await asAdmin.mutation(api.appointments.create, {
      userId,
      vehicleIds: [vehicleId],
      serviceIds: [serviceId],
      scheduledDate: APPOINTMENT_TEST_DATE,
      scheduledTime: "11:00",
      street: "789 Pine St",
      city: "Springfield",
      state: "IL",
      zip: "62703",
    });

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    // Update status to confirmed
    await asAdmin.mutation(api.appointments.updateStatus, {
      appointmentId,
      status: "confirmed",
    });

    const updatedAppointment = (await t.run(async (ctx) => {
      return await ctx.db.get(appointmentId);
    })) as any; // Cast to any to access status property

    expect(updatedAppointment?.status).toBe("confirmed");

    // Update status to completed
    await asAdmin.mutation(api.appointments.updateStatus, {
      appointmentId,
      status: "completed",
    });

    const completedAppointment = (await t.run(async (ctx) => {
      return await ctx.db.get(appointmentId);
    })) as any; // Cast to any to access status property

    expect(completedAppointment?.status).toBe("completed");
  });

  test("rejects create when setup is incomplete", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "John Doe",
        email: "john-incomplete@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-incomplete@example.com",
        role: "admin",
      });
    });
    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Valid Service",
        description: "Ready service",
        basePrice: 80,
        basePriceMedium: 80,
        duration: 60,
        serviceType: "standard",
        isActive: true,
      });
    });
    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2022,
        make: "Honda",
        model: "Accord",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-incomplete@example.com",
    });

    await expectConvexErrorCode(
      asAdmin.mutation(api.appointments.create, {
        userId,
        vehicleIds: [vehicleId],
        serviceIds: [serviceId],
        scheduledDate: APPOINTMENT_TEST_DATE,
        scheduledTime: "10:00",
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      }),
      "BOOKING_SETUP_INCOMPLETE",
    );
  });

  test("rejects create when selected service has invalid pricing", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Jane Doe",
        email: "jane-invalid-pricing@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-invalid-pricing@example.com",
        role: "admin",
      });
    });
    const vehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2023,
        make: "Kia",
        model: "Telluride",
        size: "medium",
      });
    });

    // Keep readiness true with one valid priced standard service.
    await t.run(async (ctx) => {
      await ctx.db.insert("services", {
        name: "Baseline Service",
        description: "Ready service",
        basePrice: 60,
        basePriceMedium: 60,
        duration: 60,
        serviceType: "standard",
        isActive: true,
      });
    });

    // Invalid selected service (all pricing zero).
    const invalidServiceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Broken Service",
        description: "Should not be bookable",
        basePrice: 0,
        basePriceSmall: 0,
        basePriceMedium: 0,
        basePriceLarge: 0,
        duration: 60,
        serviceType: "standard",
        isActive: true,
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-invalid-pricing@example.com",
    });

    await expectConvexErrorCode(
      asAdmin.mutation(api.appointments.create, {
        userId,
        vehicleIds: [vehicleId],
        serviceIds: [invalidServiceId],
        scheduledDate: APPOINTMENT_TEST_DATE,
        scheduledTime: "10:00",
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      }),
      "SERVICE_NOT_BOOKABLE",
    );
  });

  test("rejects create when slot is no longer available", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-slot@example.com",
        role: "admin",
      });
    });
    const customerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Customer",
        email: "customer-slot@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });
    const occupantId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Occupant",
        email: "occupant-slot@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Exterior Wash",
        description: "Service",
        basePrice: 90,
        basePriceMedium: 90,
        duration: 60,
        serviceType: "standard",
        isActive: true,
      });
    });

    const customerVehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId: customerId,
        year: 2021,
        make: "Ford",
        model: "Escape",
        size: "medium",
      });
    });
    const occupantVehicleId = await t.run(async (ctx) => {
      return await ctx.db.insert("vehicles", {
        userId: occupantId,
        year: 2020,
        make: "Toyota",
        model: "Camry",
        size: "medium",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("appointments", {
        userId: occupantId,
        vehicleIds: [occupantVehicleId],
        serviceIds: [serviceId],
        scheduledDate: APPOINTMENT_TEST_DATE,
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "confirmed",
        totalPrice: 90,
        createdBy: adminId,
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-slot@example.com",
    });

    await expectConvexErrorCode(
      asAdmin.mutation(api.appointments.create, {
        userId: customerId,
        vehicleIds: [customerVehicleId],
        serviceIds: [serviceId],
        scheduledDate: APPOINTMENT_TEST_DATE,
        scheduledTime: "11:00", // overlaps 10:00 + 2-hour block
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      }),
      "TIME_SLOT_UNAVAILABLE",
    );
  });
});
