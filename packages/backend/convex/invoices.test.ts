import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { seedBookingSetup } from "./testUtils/bookingSetup";

const BOOKING_DATE = "2024-12-02"; // Monday

async function createUser(
  t: any,
  args: { name: string; email: string; role?: "admin" | "client" },
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role ?? "client",
      timesServiced: 0,
      totalSpent: 0,
      status: "active",
    });
  });
}

async function createService(t: any, name: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("services", {
      name,
      description: `${name} description`,
      basePrice: 100,
      basePriceSmall: 90,
      basePriceMedium: 100,
      basePriceLarge: 120,
      duration: 60,
      serviceType: "standard",
      isActive: true,
    });
  });
}

async function createVehicle(t: any, userId: any, label: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("vehicles", {
      userId,
      year: 2022,
      make: "Toyota",
      model: `${label} Camry`,
      size: "medium",
      color: "Blue",
    });
  });
}

async function createRawAppointment(
  t: any,
  args: {
    userId: any;
    createdBy: any;
    serviceId: any;
    vehicleId: any;
    date?: string;
    time?: string;
  },
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("appointments", {
      userId: args.userId,
      vehicleIds: [args.vehicleId],
      serviceIds: [args.serviceId],
      scheduledDate: args.date ?? BOOKING_DATE,
      scheduledTime: args.time ?? "15:00",
      duration: 60,
      location: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
      status: "pending",
      totalPrice: 100,
      createdBy: args.createdBy,
    });
  });
}

function invoiceArgs(args: {
  appointmentId: any;
  userId: any;
  serviceId: any;
  invoiceNumber: string;
  status?: "draft" | "sent" | "paid" | "overdue";
  stripeInvoiceId?: string;
}) {
  return {
    appointmentId: args.appointmentId,
    userId: args.userId,
    invoiceNumber: args.invoiceNumber,
    items: [
      {
        serviceId: args.serviceId,
        serviceName: "Invoice Test Service",
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      },
    ],
    subtotal: 100,
    tax: 0,
    total: 100,
    status: args.status ?? "draft",
    dueDate: "2024-12-20",
    stripeInvoiceId: args.stripeInvoiceId,
    depositAmount: 50,
    depositPaid: false,
    remainingBalance: 50,
  };
}

describe("invoices", () => {
  test("owner reads are scoped while admin can list all", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t, {
      includeBookableService: false,
      includeDepositSettings: true,
    });

    const adminId = await createUser(t, {
      name: "Admin",
      email: "admin-invoices@test.com",
      role: "admin",
    });
    const ownerId = await createUser(t, {
      name: "Owner",
      email: "owner-invoices@test.com",
    });
    const otherUserId = await createUser(t, {
      name: "Other",
      email: "other-invoices@test.com",
    });

    const serviceId = await createService(t, "Invoice Service");
    const ownerVehicleId = await createVehicle(t, ownerId, "Owner");
    const otherVehicleId = await createVehicle(t, otherUserId, "Other");

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-invoices@test.com",
    });
    const asOwner = t.withIdentity({
      subject: ownerId,
      email: "owner-invoices@test.com",
    });
    const asOther = t.withIdentity({
      subject: otherUserId,
      email: "other-invoices@test.com",
    });

    const ownerBooking = await asAdmin.mutation(api.appointments.create, {
      userId: ownerId,
      vehicleIds: [ownerVehicleId],
      serviceIds: [serviceId],
      scheduledDate: BOOKING_DATE,
      scheduledTime: "10:00",
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    });

    await asAdmin.mutation(api.appointments.create, {
      userId: otherUserId,
      vehicleIds: [otherVehicleId],
      serviceIds: [serviceId],
      scheduledDate: BOOKING_DATE,
      scheduledTime: "13:00",
      street: "456 Oak St",
      city: "Springfield",
      state: "IL",
      zip: "62702",
    });

    const ownerInvoices = await asOwner.query(api.invoices.list, {});
    expect(ownerInvoices).toHaveLength(1);
    expect(ownerInvoices[0]._id).toBe(ownerBooking.invoiceId);

    const ownerDraftInvoices = await asOwner.query(api.invoices.list, {
      status: "draft",
    });
    expect(ownerDraftInvoices).toHaveLength(1);

    const ownerInvoice = await asOwner.query(api.invoices.getById, {
      invoiceId: ownerBooking.invoiceId,
    });
    expect(ownerInvoice?._id).toBe(ownerBooking.invoiceId);

    await expect(
      asOther.query(api.invoices.getById, { invoiceId: ownerBooking.invoiceId }),
    ).rejects.toThrow("Access denied");

    const allInvoicesForAdmin = await asAdmin.query(api.invoices.list, {});
    expect(allInvoicesForAdmin).toHaveLength(2);
  });

  test("getByAppointment is owner-or-admin only", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t, {
      includeBookableService: false,
      includeDepositSettings: true,
    });

    const adminId = await createUser(t, {
      name: "Admin",
      email: "admin-appointment@test.com",
      role: "admin",
    });
    const ownerId = await createUser(t, {
      name: "Owner",
      email: "owner-appointment@test.com",
    });
    const otherUserId = await createUser(t, {
      name: "Other",
      email: "other-appointment@test.com",
    });

    const serviceId = await createService(t, "By Appointment Service");
    const ownerVehicleId = await createVehicle(t, ownerId, "Owner");

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-appointment@test.com",
    });
    const asOwner = t.withIdentity({
      subject: ownerId,
      email: "owner-appointment@test.com",
    });
    const asOther = t.withIdentity({
      subject: otherUserId,
      email: "other-appointment@test.com",
    });

    const { appointmentId, invoiceId } = await asAdmin.mutation(
      api.appointments.create,
      {
        userId: ownerId,
        vehicleIds: [ownerVehicleId],
        serviceIds: [serviceId],
        scheduledDate: BOOKING_DATE,
        scheduledTime: "10:00",
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
    );

    const ownerInvoice = await asOwner.query(api.invoices.getByAppointment, {
      appointmentId,
    });
    expect(ownerInvoice?._id).toBe(invoiceId);

    const adminInvoice = await asAdmin.query(api.invoices.getByAppointment, {
      appointmentId,
    });
    expect(adminInvoice?._id).toBe(invoiceId);

    await expect(
      asOther.query(api.invoices.getByAppointment, { appointmentId }),
    ).rejects.toThrow("Access denied");
  });

  test("invoice public writes are admin-only", async () => {
    const t = convexTest(schema, modules);

    const adminId = await createUser(t, {
      name: "Admin",
      email: "admin-writes@test.com",
      role: "admin",
    });
    const clientId = await createUser(t, {
      name: "Client",
      email: "client-writes@test.com",
    });

    const serviceId = await createService(t, "Write Guard Service");
    const vehicleId = await createVehicle(t, clientId, "Client");
    const appointmentId = await createRawAppointment(t, {
      userId: clientId,
      createdBy: adminId,
      serviceId,
      vehicleId,
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-writes@test.com",
    });
    const asClient = t.withIdentity({
      subject: clientId,
      email: "client-writes@test.com",
    });

    const invoiceId = await asAdmin.mutation(
      api.invoices.create,
      invoiceArgs({
        appointmentId,
        userId: clientId,
        serviceId,
        invoiceNumber: "INV-ACL-001",
      }),
    );

    await expect(
      asClient.mutation(
        api.invoices.create,
        invoiceArgs({
          appointmentId,
          userId: clientId,
          serviceId,
          invoiceNumber: "INV-ACL-002",
        }),
      ),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.invoices.updateStatus, {
        invoiceId,
        status: "sent",
      }),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.invoices.updateDepositStatus, {
        invoiceId,
        depositPaid: true,
      }),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.invoices.updateFinalPayment, {
        invoiceId,
        finalPaymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("Admin access required");

    await expect(
      asClient.mutation(api.invoices.deleteInvoice, {
        id: invoiceId,
      }),
    ).rejects.toThrow("Admin access required");
  });

  test("admin can update statuses and paid invoices cannot be deleted", async () => {
    const t = convexTest(schema, modules);

    const adminId = await createUser(t, {
      name: "Admin",
      email: "admin-status@test.com",
      role: "admin",
    });
    const clientId = await createUser(t, {
      name: "Client",
      email: "client-status@test.com",
    });

    const serviceId = await createService(t, "Status Service");
    const vehicleId = await createVehicle(t, clientId, "Client");
    const appointmentId = await createRawAppointment(t, {
      userId: clientId,
      createdBy: adminId,
      serviceId,
      vehicleId,
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-status@test.com",
    });

    const invoiceId = await asAdmin.mutation(
      api.invoices.create,
      invoiceArgs({
        appointmentId,
        userId: clientId,
        serviceId,
        invoiceNumber: "INV-STATUS-001",
      }),
    );

    await asAdmin.mutation(api.invoices.updateDepositStatus, {
      invoiceId,
      depositPaid: true,
      depositPaymentIntentId: "pi_deposit_123",
    });

    await asAdmin.mutation(api.invoices.updateFinalPayment, {
      invoiceId,
      finalPaymentIntentId: "pi_final_123",
    });

    await asAdmin.mutation(api.invoices.updateStatus, {
      invoiceId,
      status: "paid",
      paidDate: "2024-12-10",
    });

    const paidInvoice = await t.run(async (ctx: any) => {
      return await ctx.db.get(invoiceId);
    });
    expect(paidInvoice?.status).toBe("paid");
    expect(paidInvoice?.paidDate).toBe("2024-12-10");
    expect(paidInvoice?.depositPaid).toBe(true);
    expect(paidInvoice?.finalPaymentIntentId).toBe("pi_final_123");

    await expect(
      asAdmin.mutation(api.invoices.deleteInvoice, { id: invoiceId }),
    ).rejects.toThrow("Cannot delete a paid invoice");
  });

  test("internal invoice interfaces support webhook/system access", async () => {
    const t = convexTest(schema, modules);

    const adminId = await createUser(t, {
      name: "Admin",
      email: "admin-internal@test.com",
      role: "admin",
    });
    const clientId = await createUser(t, {
      name: "Client",
      email: "client-internal@test.com",
    });

    const serviceId = await createService(t, "Internal Service");
    const vehicleId = await createVehicle(t, clientId, "Client");
    const appointmentId = await createRawAppointment(t, {
      userId: clientId,
      createdBy: adminId,
      serviceId,
      vehicleId,
    });

    const internalInvoiceId = await t.mutation(
      internal.invoices.createInternal,
      invoiceArgs({
        appointmentId,
        userId: clientId,
        serviceId,
        invoiceNumber: "INV-INTERNAL-001",
        status: "sent",
      }),
    );

    await t.mutation(internal.invoices.updateStripeInvoiceData, {
      invoiceId: internalInvoiceId,
      stripeInvoiceId: "in_test_internal_123",
      status: "sent",
    });

    const foundByStripe = await t.query(
      internal.invoices.getByStripeIdInternal,
      {
        stripeInvoiceId: "in_test_internal_123",
      },
    );
    expect(foundByStripe?._id).toBe(internalInvoiceId);

    const countResult = await t.query(internal.invoices.getCountInternal, {});
    expect(countResult.count).toBeGreaterThan(0);
  });
});
