import { convexTest } from "convex-test";
import { expect, test, describe, vi, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("invoices", () => {
  // Helper function to create test user
  async function createTestUser(t: any) {
    return await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
        phone: "555-1234",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });
  }

  // Helper function to create test appointment
  async function createTestAppointment(t: any, userId: any, adminId: any) {
    const categoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("serviceCategories", {
        name: "Test Category",
        type: "standard",
      });
    });

    const serviceId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("services", {
        name: "Test Service",
        description: "Test service description",
        basePrice: 50,
        duration: 60,
        categoryId,
        isActive: true,
      });
    });

    const vehicleId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("vehicles", {
        userId,
        year: 2020,
        make: "Toyota",
        model: "Camry",
        color: "Blue",
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("depositSettings", {
        amountPerVehicle: 50,
        isActive: true,
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId, email: "admin@test.com" });
    const { appointmentId, invoiceId } = await asAdmin.mutation(
      api.appointments.create,
      {
        userId,
        vehicleIds: [vehicleId],
        serviceIds: [serviceId],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
    );

    return { appointmentId, invoiceId };
  }

  test("create invoice", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);

    const appointmentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });
    const invoiceId = await asUser.mutation(api.invoices.create, {
      appointmentId,
      userId,
      invoiceNumber: "INV-001",
      items: [
        {
          serviceId: await t.run(async (ctx: any) => {
            const categoryId = await ctx.db.insert("serviceCategories", {
              name: "Test",
              type: "standard",
            });
            const serviceId = await ctx.db.insert("services", {
              name: "Service",
              description: "Test",
              basePrice: 50,
              duration: 60,
              categoryId,
              isActive: true,
            });
            return serviceId;
          }),
          serviceName: "Test Service",
          quantity: 1,
          unitPrice: 50,
          totalPrice: 50,
        },
      ],
      subtotal: 50,
      tax: 0,
      total: 50,
      status: "draft",
      dueDate: "2024-12-15",
      depositAmount: 25,
      remainingBalance: 25,
    });

    expect(invoiceId).toBeDefined();

    const invoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    });

    expect(invoice).toMatchObject({
      appointmentId,
      userId,
      invoiceNumber: "INV-001",
      subtotal: 50,
      total: 50,
      status: "draft",
      depositAmount: 25,
      remainingBalance: 25,
    });
  });

  test("list invoices with status filter", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });

    // Create multiple invoices with different statuses
    const appointmentId1 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    await asUser.mutation(api.invoices.create, {
      appointmentId: appointmentId1,
      userId,
      invoiceNumber: "INV-001",
      items: [],
      subtotal: 50,
      tax: 0,
      total: 50,
      status: "draft",
      dueDate: "2024-12-15",
    });

    const appointmentId2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-02",
        scheduledTime: "11:00",
        duration: 60,
        location: {
          street: "456 Oak St",
          city: "Springfield",
          state: "IL",
          zip: "62702",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const invoiceId2 = await asUser.mutation(api.invoices.create, {
      appointmentId: appointmentId2,
      userId,
      invoiceNumber: "INV-002",
      items: [],
      subtotal: 75,
      tax: 0,
      total: 75,
      status: "sent",
      dueDate: "2024-12-15",
    });

    // Update to paid status (paidDate is set automatically)
    await asUser.mutation(api.invoices.updateStatus, {
      invoiceId: invoiceId2,
      status: "paid",
      paidDate: "2024-12-10",
    });

    // List all invoices
    const allInvoices = await asUser.query(api.invoices.list, {});
    expect(allInvoices.length).toBe(2);

    // Filter by status
    const draftInvoices = await asUser.query(api.invoices.list, {
      status: "draft",
    });
    expect(draftInvoices.length).toBe(1);
    expect(draftInvoices[0].invoiceNumber).toBe("INV-001");

    const paidInvoices = await asUser.query(api.invoices.list, {
      status: "paid",
    });
    expect(paidInvoices.length).toBe(1);
    expect(paidInvoices[0].invoiceNumber).toBe("INV-002");
  });

  test("get invoice by ID", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });

    const appointmentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const invoiceId = await asUser.mutation(api.invoices.create, {
      appointmentId,
      userId,
      invoiceNumber: "INV-003",
      items: [],
      subtotal: 100,
      tax: 0,
      total: 100,
      status: "sent",
      dueDate: "2024-12-15",
    });

    const invoice = await asUser.query(api.invoices.getById, {
      invoiceId,
    });

    expect(invoice).toMatchObject({
      invoiceNumber: "INV-003",
      total: 100,
      status: "sent",
    });
  });

  test("get invoice by appointment", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const adminId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      });
    });

    const { appointmentId, invoiceId } = await createTestAppointment(
      t,
      userId,
      adminId,
    );

    // Wait for scheduled functions to complete
    await t.finishInProgressScheduledFunctions();

    const invoice = await t.query(api.invoices.getByAppointment, {
      appointmentId,
    });

    expect(invoice).toBeDefined();
    expect(invoice?._id).toBe(invoiceId);
    expect(invoice?.appointmentId).toBe(appointmentId);
  });

  test("update invoice status", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });

    const appointmentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const invoiceId = await asUser.mutation(api.invoices.create, {
      appointmentId,
      userId,
      invoiceNumber: "INV-004",
      items: [],
      subtotal: 100,
      tax: 0,
      total: 100,
      status: "draft",
      dueDate: "2024-12-15",
    });

    // Update to sent
    await asUser.mutation(api.invoices.updateStatus, {
      invoiceId,
      status: "sent",
    });

    let invoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    });
    expect(invoice?.status).toBe("sent");
    expect(invoice?.paidDate).toBeUndefined();

    // Update to paid
    const paidDate = "2024-12-10";
    await asUser.mutation(api.invoices.updateStatus, {
      invoiceId,
      status: "paid",
      paidDate,
    });

    invoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    });
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidDate).toBe(paidDate);
  });

  test("update deposit status", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });

    const appointmentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const invoiceId = await asUser.mutation(api.invoices.create, {
      appointmentId,
      userId,
      invoiceNumber: "INV-005",
      items: [],
      subtotal: 100,
      tax: 0,
      total: 100,
      status: "draft",
      dueDate: "2024-12-15",
      depositAmount: 50,
      depositPaid: false,
      remainingBalance: 50,
    });

    // Update deposit status via internal mutation (as webhook would)
    await t.mutation(internal.invoices.updateDepositStatusInternal, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_test_123",
    });

    const invoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    });

    expect(invoice?.depositPaid).toBe(true);
    expect(invoice?.depositPaymentIntentId).toBe("pi_test_123");
  });

  test("update final payment status", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });

    const appointmentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const invoiceId = await asUser.mutation(api.invoices.create, {
      appointmentId,
      userId,
      invoiceNumber: "INV-006",
      items: [],
      subtotal: 100,
      tax: 0,
      total: 100,
      status: "sent",
      dueDate: "2024-12-15",
      depositAmount: 50,
      depositPaid: true,
      remainingBalance: 50,
    });

    // Update final payment status via internal mutations
    // (In real webhook, both are called - updateFinalPaymentInternal and updateStatusInternal)
    await t.mutation(internal.invoices.updateFinalPaymentInternal, {
      invoiceId,
      finalPaymentIntentId: "pi_final_123",
    });

    // Also update status to paid (as webhook does)
    await t.mutation(internal.invoices.updateStatusInternal, {
      invoiceId,
      status: "paid",
      paidDate: new Date().toISOString().split("T")[0],
    });

    const invoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    });

    expect(invoice?.finalPaymentIntentId).toBe("pi_final_123");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidDate).toBeDefined();
  });

  test("delete invoice", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });

    const appointmentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const invoiceId = await asUser.mutation(api.invoices.create, {
      appointmentId,
      userId,
      invoiceNumber: "INV-007",
      items: [],
      subtotal: 100,
      tax: 0,
      total: 100,
      status: "draft",
      dueDate: "2024-12-15",
    });

    // Delete invoice
    await asUser.mutation(api.invoices.deleteInvoice, {
      id: invoiceId,
    });

    // Verify deletion
    const invoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    });
    expect(invoice).toBeNull();
  });

  test("cannot delete paid invoice", async () => {
    const t = convexTest(schema, modules);
    const userId = await createTestUser(t);
    const asUser = t.withIdentity({ subject: userId, email: "test@example.com" });

    const appointmentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "pending",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const invoiceId = await asUser.mutation(api.invoices.create, {
      appointmentId,
      userId,
      invoiceNumber: "INV-008",
      items: [],
      subtotal: 100,
      tax: 0,
      total: 100,
      status: "sent",
      dueDate: "2024-12-15",
    });

    // Update to paid status (paidDate is set automatically)
    await asUser.mutation(api.invoices.updateStatus, {
      invoiceId,
      status: "paid",
      paidDate: "2024-12-10",
    });

    // Try to delete paid invoice - should fail
    await expect(
      asUser.mutation(api.invoices.deleteInvoice, {
        id: invoiceId,
      }),
    ).rejects.toThrow("Cannot delete a paid invoice");
  });
});

