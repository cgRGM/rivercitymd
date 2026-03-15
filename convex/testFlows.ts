import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./auth";

// ---------------------------------------------------------------------------
// Helper mutations – create minimal test data
// ---------------------------------------------------------------------------

export const createTestAppointment = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const services = await ctx.db.query("services").collect();
    const activeService = services.find((s) => s.isActive);
    if (!activeService) throw new Error("No active service found");

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let vehicleId: Id<"vehicles">;
    if (vehicles.length > 0) {
      vehicleId = vehicles[0]._id;
    } else {
      vehicleId = await ctx.db.insert("vehicles", {
        userId: args.userId,
        year: 2024,
        make: "Test",
        model: "Vehicle",
        size: "medium",
      });
    }

    const user = await ctx.db.get(args.userId);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduledDate = tomorrow.toISOString().split("T")[0];

    return await ctx.db.insert("appointments", {
      userId: args.userId,
      vehicleIds: [vehicleId],
      serviceIds: [activeService._id],
      scheduledDate,
      scheduledTime: "10:00",
      duration: activeService.duration || 60,
      location: user?.address
        ? {
            street: user.address.street,
            city: user.address.city,
            state: user.address.state,
            zip: user.address.zip,
          }
        : {
            street: "123 Test St",
            city: "Little Rock",
            state: "AR",
            zip: "72201",
          },
      status: "confirmed",
      totalPrice:
        activeService.basePriceMedium || activeService.basePrice || 100,
      createdBy: args.userId,
      isTest: true,
    });
  },
});

export const createTestInvoice = internalMutation({
  args: {
    userId: v.id("users"),
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    const service = await ctx.db.get(appointment.serviceIds[0]);
    const invoiceCount = (await ctx.db.query("invoices").collect()).length;

    return await ctx.db.insert("invoices", {
      appointmentId: args.appointmentId,
      userId: args.userId,
      invoiceNumber: `TEST-${String(invoiceCount + 1).padStart(4, "0")}`,
      items: [
        {
          serviceId: appointment.serviceIds[0],
          serviceName: service?.name || "Test Service",
          quantity: appointment.vehicleIds.length,
          unitPrice: appointment.totalPrice / appointment.vehicleIds.length,
          totalPrice: appointment.totalPrice,
        },
      ],
      subtotal: appointment.totalPrice,
      tax: 0,
      total: appointment.totalPrice,
      status: "draft",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      depositAmount: 50 * appointment.vehicleIds.length,
      depositPaid: true,
      remainingBalance:
        appointment.totalPrice - 50 * appointment.vehicleIds.length,
    });
  },
});

export const createTestReview = internalMutation({
  args: {
    userId: v.id("users"),
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reviews", {
      userId: args.userId,
      appointmentId: args.appointmentId,
      rating: 5,
      comment: "Test review - excellent service!",
      isPublic: true,
      reviewDate: new Date().toISOString().split("T")[0],
    });
  },
});

export const createTestTripLog = internalMutation({
  args: {
    userId: v.id("users"),
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    const now = Date.now();
    return await ctx.db.insert("tripLogs", {
      source: "appointment",
      appointmentId: args.appointmentId,
      userId: args.userId,
      requiredForAppointment: true,
      status: "draft",
      logDate:
        appointment?.scheduledDate ||
        new Date().toISOString().split("T")[0],
      businessPurpose: "Test - Mobile detailing service",
      start: {
        addressLabel: "Home Base",
        street: "100 Main St",
        city: "Little Rock",
        state: "AR",
        postalCode: "72201",
      },
      stops: [
        {
          addressLabel: "Customer Location",
          street: "123 Test St",
          city: "Little Rock",
          state: "AR",
          postalCode: "72201",
        },
      ],
      mileageSource: "manual",
      finalMiles: 15,
      expenseTotalCents: 0,
      createdBy: args.userId,
      updatedBy: args.userId,
      updatedAt: now,
    });
  },
});

// Find or create a test user by email (for sending customer-facing test emails to dev)
export const ensureTestUser = internalMutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      role: "client",
      status: "active",
    });
  },
});

export const cleanupTestData = internalMutation({
  args: {
    appointmentId: v.optional(v.id("appointments")),
    invoiceId: v.optional(v.id("invoices")),
    reviewId: v.optional(v.id("reviews")),
    tripLogId: v.optional(v.id("tripLogs")),
  },
  handler: async (ctx, args) => {
    if (args.reviewId) await ctx.db.delete(args.reviewId);
    if (args.tripLogId) await ctx.db.delete(args.tripLogId);
    if (args.invoiceId) await ctx.db.delete(args.invoiceId);
    if (args.appointmentId) await ctx.db.delete(args.appointmentId);
  },
});

// ---------------------------------------------------------------------------
// Main test scenario runner
// ---------------------------------------------------------------------------

export const runTestScenario = internalAction({
  args: {
    scenario: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    scenario: v.string(),
    error: v.optional(v.string()),
    warnings: v.optional(v.array(v.string())),
  }),
  handler: async (ctx, args) => {
    const warnings: string[] = [];

    // Run a call that is allowed to fail (e.g. SMS when Twilio is misconfigured).
    // Failures are collected as warnings instead of aborting the scenario.
    const soft = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`${label}: ${msg}`);
        console.warn(`[test-flow] ${label} failed:`, msg);
      }
    };

    try {
      // Resolve the admin user (dustin@rivercitymd.com)
      const adminUserId = await ctx.runQuery(
        internal.auth.getUserIdByEmail,
        { email: "dustin@rivercitymd.com" },
      );
      if (!adminUserId) {
        throw new Error("Admin user not found");
      }

      const user = await ctx.runQuery(internal.users.getByIdInternal, {
        userId: adminUserId,
      });
      if (!user) {
        throw new Error("Admin user not found");
      }

      const userId = user._id;

      // Ensure dev user exists for customer-facing email copies
      const DEV_EMAIL = "cg@rocktownlabs.com";
      const devUserId = await ctx.runMutation(
        internal.testFlows.ensureTestUser,
        { email: DEV_EMAIL, name: "CG (Dev)" },
      );

      switch (args.scenario) {
        // -------------------------------------------------------------------
        // 1. new_customer_onboarded
        // -------------------------------------------------------------------
        case "new_customer_onboarded": {
          await ctx.runAction(
            internal.emails.sendAdminNewCustomerNotification,
            { userId },
          );
          await ctx.runAction(
            internal.emails.sendAdminNewCustomerNotification,
            { userId, recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: new customer onboarded", () =>
            ctx.runMutation(
              internal.notifications.queueNewCustomerOnboarded,
              { userId },
            ),
          );
          break;
        }

        // -------------------------------------------------------------------
        // 2. welcome_email
        // -------------------------------------------------------------------
        case "welcome_email": {
          await ctx.runAction(internal.emails.sendWelcomeEmail, { userId });
          // Also send to dev
          await ctx.runAction(internal.emails.sendWelcomeEmail, { userId: devUserId });
          break;
        }

        // -------------------------------------------------------------------
        // 3. deposit_paid
        // -------------------------------------------------------------------
        case "deposit_paid": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const invoiceId = await ctx.runMutation(
            internal.testFlows.createTestInvoice,
            { userId, appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAdminDepositPaidNotification,
            { appointmentId, invoiceId },
          );
          await ctx.runAction(
            internal.emails.sendAdminDepositPaidNotification,
            { appointmentId, invoiceId, recipientOverride: DEV_EMAIL },
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
            invoiceId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 4. appointment_confirmed
        // -------------------------------------------------------------------
        case "appointment_confirmed": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );
          await ctx.runAction(
            internal.emails.sendAppointmentConfirmationEmail,
            { appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAppointmentConfirmationEmail,
            { appointmentId: devAppointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "confirmed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "confirmed", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment confirmed", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_confirmed" },
            ),
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 5. appointment_cancelled
        // -------------------------------------------------------------------
        case "appointment_cancelled": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "cancelled" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "cancelled" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "cancelled" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "cancelled", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment cancelled", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_cancelled" },
            ),
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 6. appointment_rescheduled
        // -------------------------------------------------------------------
        case "appointment_rescheduled": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "rescheduled" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "rescheduled" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "rescheduled" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "rescheduled", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment rescheduled", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_rescheduled" },
            ),
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 7. appointment_started
        // -------------------------------------------------------------------
        case "appointment_started": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "in_progress" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "in_progress" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "started" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "started", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment started", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_started" },
            ),
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 8. appointment_completed
        // -------------------------------------------------------------------
        case "appointment_completed": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "completed", recipientOverride: DEV_EMAIL },
          );
          await ctx.runAction(
            internal.emails.sendCustomerReviewRequestEmail,
            { appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendCustomerReviewRequestEmail,
            { appointmentId: devAppointmentId },
          );
          await soft("SMS: appointment completed", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_completed" },
            ),
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 9. reminder
        // -------------------------------------------------------------------
        case "reminder": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );
          await ctx.runAction(
            internal.emails.sendAppointmentReminderEmail,
            { appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAppointmentReminderEmail,
            { appointmentId: devAppointmentId },
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 10. review_submitted
        // -------------------------------------------------------------------
        case "review_submitted": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const reviewId = await ctx.runMutation(
            internal.testFlows.createTestReview,
            { userId, appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAdminReviewSubmittedNotification,
            { reviewId },
          );
          await ctx.runAction(
            internal.emails.sendAdminReviewSubmittedNotification,
            { reviewId, recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: review submitted", () =>
            ctx.runMutation(
              internal.notifications.queueReviewSubmitted,
              { reviewId },
            ),
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
            reviewId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 11. mileage_log_required
        // -------------------------------------------------------------------
        case "mileage_log_required": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const tripLogId = await ctx.runMutation(
            internal.testFlows.createTestTripLog,
            { userId, appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAdminMileageLogRequiredNotification,
            { tripLogId },
          );
          await ctx.runAction(
            internal.emails.sendAdminMileageLogRequiredNotification,
            { tripLogId, recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: mileage log required", () =>
            ctx.runMutation(
              internal.notifications.queueMileageLogRequired,
              { tripLogId, appointmentId },
            ),
          );
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
            tripLogId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 12. full_guest_checkout (1→3→4→7→8)
        // -------------------------------------------------------------------
        case "full_guest_checkout": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );
          const invoiceId = await ctx.runMutation(
            internal.testFlows.createTestInvoice,
            { userId, appointmentId },
          );

          // Step 1: new_customer_onboarded
          await ctx.runAction(
            internal.emails.sendAdminNewCustomerNotification,
            { userId },
          );
          await ctx.runAction(
            internal.emails.sendAdminNewCustomerNotification,
            { userId, recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: new customer onboarded (flow)", () =>
            ctx.runMutation(
              internal.notifications.queueNewCustomerOnboarded,
              { userId },
            ),
          );

          await new Promise((r) => setTimeout(r, 2000));

          // Step 3: deposit_paid
          await ctx.runAction(
            internal.emails.sendAdminDepositPaidNotification,
            { appointmentId, invoiceId },
          );
          await ctx.runAction(
            internal.emails.sendAdminDepositPaidNotification,
            { appointmentId, invoiceId, recipientOverride: DEV_EMAIL },
          );

          await new Promise((r) => setTimeout(r, 2000));

          // Step 4: appointment_confirmed
          await ctx.runAction(
            internal.emails.sendAppointmentConfirmationEmail,
            { appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAppointmentConfirmationEmail,
            { appointmentId: devAppointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "confirmed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "confirmed", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment confirmed (flow)", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_confirmed" },
            ),
          );

          await new Promise((r) => setTimeout(r, 2000));

          // Step 7: appointment_started
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "in_progress" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "in_progress" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "started" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "started", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment started (flow)", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_started" },
            ),
          );

          await new Promise((r) => setTimeout(r, 2000));

          // Step 8: appointment_completed
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "completed", recipientOverride: DEV_EMAIL },
          );
          await ctx.runAction(
            internal.emails.sendCustomerReviewRequestEmail,
            { appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendCustomerReviewRequestEmail,
            { appointmentId: devAppointmentId },
          );
          await soft("SMS: appointment completed (flow)", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_completed" },
            ),
          );

          // Cleanup
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
            invoiceId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        // -------------------------------------------------------------------
        // 13. full_returning_customer (2→4→7→8)
        // -------------------------------------------------------------------
        case "full_returning_customer": {
          const appointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId },
          );
          const devAppointmentId = await ctx.runMutation(
            internal.testFlows.createTestAppointment,
            { userId: devUserId },
          );

          // Step 2: welcome_email
          await ctx.runAction(internal.emails.sendWelcomeEmail, { userId });
          await ctx.runAction(internal.emails.sendWelcomeEmail, { userId: devUserId });

          await new Promise((r) => setTimeout(r, 2000));

          // Step 4: appointment_confirmed
          await ctx.runAction(
            internal.emails.sendAppointmentConfirmationEmail,
            { appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAppointmentConfirmationEmail,
            { appointmentId: devAppointmentId },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "confirmed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "confirmed", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment confirmed (flow)", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_confirmed" },
            ),
          );

          await new Promise((r) => setTimeout(r, 2000));

          // Step 7: appointment_started
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "in_progress" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "in_progress" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "started" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "started", recipientOverride: DEV_EMAIL },
          );
          await soft("SMS: appointment started (flow)", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_started" },
            ),
          );

          await new Promise((r) => setTimeout(r, 2000));

          // Step 8: appointment_completed
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId, status: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendCustomerAppointmentStatusEmail,
            { appointmentId: devAppointmentId, status: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "completed" },
          );
          await ctx.runAction(
            internal.emails.sendAdminAppointmentNotification,
            { appointmentId, action: "completed", recipientOverride: DEV_EMAIL },
          );
          await ctx.runAction(
            internal.emails.sendCustomerReviewRequestEmail,
            { appointmentId },
          );
          await ctx.runAction(
            internal.emails.sendCustomerReviewRequestEmail,
            { appointmentId: devAppointmentId },
          );
          await soft("SMS: appointment completed (flow)", () =>
            ctx.runMutation(
              internal.notifications.queueAppointmentLifecycleEvent,
              { appointmentId, event: "appointment_completed" },
            ),
          );

          // Cleanup
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId,
          });
          await ctx.runMutation(internal.testFlows.cleanupTestData, {
            appointmentId: devAppointmentId,
          });
          break;
        }

        default:
          return {
            success: false,
            scenario: args.scenario,
            error: `Unknown scenario: ${args.scenario}`,
          };
      }

      return {
        success: true,
        scenario: args.scenario,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      return {
        success: false,
        scenario: args.scenario,
        error: message,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  },
});

// Public action wrapper for frontend (requires admin auth)
export const runTestScenarioPublic = action({
  args: {
    scenario: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    scenario: v.string(),
    error: v.optional(v.string()),
    warnings: v.optional(v.array(v.string())),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; scenario: string; error?: string; warnings?: string[] }> => {
    await requireAdmin(ctx);
    return await ctx.runAction(internal.testFlows.runTestScenario, {
      scenario: args.scenario,
    });
  },
});
