import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, getUserIdFromIdentity } from "./auth";

// ---------------------------------------------------------------------------
// Recipients for test emails
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "dustin@rivercitymd.com";
const DEV_EMAIL = "cg@rocktownlabs.com";
const ALL_RECIPIENTS = [ADMIN_EMAIL, DEV_EMAIL];

// ---------------------------------------------------------------------------
// Helper: send a test email template to all test recipients
// ---------------------------------------------------------------------------

async function sendTest(
  ctx: { runAction: typeof Function.prototype },
  template: string,
) {
  await (ctx as any).runAction(internal.testEmails.sendTestEmail, {
    template,
    recipients: ALL_RECIPIENTS,
  });
}

// ---------------------------------------------------------------------------
// Cleanup mutation — purge remaining isTest records from production tables
// ---------------------------------------------------------------------------

export const cleanupAllTestData = internalMutation({
  args: {},
  returns: v.object({
    deletedAppointments: v.number(),
    deletedInvoices: v.number(),
    deletedReviews: v.number(),
  }),
  handler: async (ctx) => {
    let deletedAppointments = 0;
    let deletedInvoices = 0;
    let deletedReviews = 0;

    // Delete test appointments and their linked invoices/reviews
    const allAppointments = await ctx.db.query("appointments").collect();
    for (const apt of allAppointments) {
      if (apt.isTest) {
        // Delete linked invoices
        const invoices = await ctx.db
          .query("invoices")
          .withIndex("by_appointment", (q) => q.eq("appointmentId", apt._id))
          .collect();
        for (const inv of invoices) {
          await ctx.db.delete(inv._id);
          deletedInvoices++;
        }

        // Delete linked reviews
        const reviews = await ctx.db
          .query("reviews")
          .filter((q) => q.eq(q.field("appointmentId"), apt._id))
          .collect();
        for (const rev of reviews) {
          await ctx.db.delete(rev._id);
          deletedReviews++;
        }

        await ctx.db.delete(apt._id);
        deletedAppointments++;
      }
    }

    return { deletedAppointments, deletedInvoices, deletedReviews };
  },
});

// Public wrapper for cleanup (requires admin)
export const cleanupAllTestDataPublic = action({
  args: {},
  returns: v.object({
    deletedAppointments: v.number(),
    deletedInvoices: v.number(),
    deletedReviews: v.number(),
  }),
  handler: async (ctx): Promise<{ deletedAppointments: number; deletedInvoices: number; deletedReviews: number }> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.testFlows.cleanupAllTestData, {});
  },
});

// ---------------------------------------------------------------------------
// Main test scenario runner — fully isolated, no production table inserts
// ---------------------------------------------------------------------------

export const runTestScenario = internalAction({
  args: {
    scenario: v.string(),
    adminUserId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    scenario: v.string(),
    error: v.optional(v.string()),
    warnings: v.optional(v.array(v.string())),
  }),
  handler: async (ctx, args) => {
    const warnings: string[] = [];

    try {
      // Verify admin user exists
      const user = await ctx.runQuery(internal.users.getByIdInternal, {
        userId: args.adminUserId,
      });
      if (!user) {
        throw new Error("Admin user not found in database");
      }

      switch (args.scenario) {
        // -------------------------------------------------------------------
        // 1. new_customer_onboarded
        // -------------------------------------------------------------------
        case "new_customer_onboarded": {
          await sendTest(ctx, "admin_new_customer");
          break;
        }

        // -------------------------------------------------------------------
        // 2. welcome_email
        // -------------------------------------------------------------------
        case "welcome_email": {
          await sendTest(ctx, "welcome");
          break;
        }

        // -------------------------------------------------------------------
        // 3. deposit_paid
        // -------------------------------------------------------------------
        case "deposit_paid": {
          await sendTest(ctx, "admin_deposit_paid");
          break;
        }

        // -------------------------------------------------------------------
        // 4. appointment_confirmed
        // -------------------------------------------------------------------
        case "appointment_confirmed": {
          await sendTest(ctx, "appointment_confirmation");
          await sendTest(ctx, "admin_appointment_confirmed");
          break;
        }

        // -------------------------------------------------------------------
        // 5. appointment_cancelled
        // -------------------------------------------------------------------
        case "appointment_cancelled": {
          await sendTest(ctx, "customer_status_cancelled");
          await sendTest(ctx, "admin_appointment_cancelled");
          break;
        }

        // -------------------------------------------------------------------
        // 6. appointment_rescheduled
        // -------------------------------------------------------------------
        case "appointment_rescheduled": {
          await sendTest(ctx, "customer_status_rescheduled");
          await sendTest(ctx, "admin_appointment_rescheduled");
          break;
        }

        // -------------------------------------------------------------------
        // 7. appointment_started
        // -------------------------------------------------------------------
        case "appointment_started": {
          await sendTest(ctx, "customer_status_in_progress");
          await sendTest(ctx, "admin_appointment_started");
          break;
        }

        // -------------------------------------------------------------------
        // 8. appointment_completed
        // -------------------------------------------------------------------
        case "appointment_completed": {
          await sendTest(ctx, "customer_status_completed");
          await sendTest(ctx, "admin_appointment_completed");
          await sendTest(ctx, "customer_review_request");
          break;
        }

        // -------------------------------------------------------------------
        // 9. reminder
        // -------------------------------------------------------------------
        case "reminder": {
          await sendTest(ctx, "appointment_reminder");
          break;
        }

        // -------------------------------------------------------------------
        // 10. review_submitted
        // -------------------------------------------------------------------
        case "review_submitted": {
          await sendTest(ctx, "admin_review_submitted");
          break;
        }

        // -------------------------------------------------------------------
        // 11. mileage_log_required
        // -------------------------------------------------------------------
        case "mileage_log_required": {
          await sendTest(ctx, "admin_mileage_log_required");
          break;
        }

        // -------------------------------------------------------------------
        // 12. full_guest_checkout (1→3→4→7→8)
        // -------------------------------------------------------------------
        case "full_guest_checkout": {
          // Step 1: new customer
          await sendTest(ctx, "admin_new_customer");
          await new Promise((r) => setTimeout(r, 1000));

          // Step 3: deposit paid
          await sendTest(ctx, "admin_deposit_paid");
          await new Promise((r) => setTimeout(r, 1000));

          // Step 4: confirmed
          await sendTest(ctx, "appointment_confirmation");
          await sendTest(ctx, "admin_appointment_confirmed");
          await new Promise((r) => setTimeout(r, 1000));

          // Step 7: started
          await sendTest(ctx, "customer_status_in_progress");
          await sendTest(ctx, "admin_appointment_started");
          await new Promise((r) => setTimeout(r, 1000));

          // Step 8: completed
          await sendTest(ctx, "customer_status_completed");
          await sendTest(ctx, "admin_appointment_completed");
          await sendTest(ctx, "customer_review_request");
          break;
        }

        // -------------------------------------------------------------------
        // 13. full_returning_customer (2→4→7→8)
        // -------------------------------------------------------------------
        case "full_returning_customer": {
          // Step 2: welcome
          await sendTest(ctx, "welcome");
          await new Promise((r) => setTimeout(r, 1000));

          // Step 4: confirmed
          await sendTest(ctx, "appointment_confirmation");
          await sendTest(ctx, "admin_appointment_confirmed");
          await new Promise((r) => setTimeout(r, 1000));

          // Step 7: started
          await sendTest(ctx, "customer_status_in_progress");
          await sendTest(ctx, "admin_appointment_started");
          await new Promise((r) => setTimeout(r, 1000));

          // Step 8: completed
          await sendTest(ctx, "customer_status_completed");
          await sendTest(ctx, "admin_appointment_completed");
          await sendTest(ctx, "customer_review_request");
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
    const adminUserId = await getUserIdFromIdentity(ctx);
    if (!adminUserId) {
      return { success: false, scenario: args.scenario, error: "Could not resolve admin user" };
    }
    return await ctx.runAction(internal.testFlows.runTestScenario, {
      scenario: args.scenario,
      adminUserId,
    });
  },
});
