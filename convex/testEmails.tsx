// IMPORTANT: this is a Convex Node Action
"use node";

/**
 * Test-only email rendering + sending.
 * Builds email HTML from templates with inline fake data — no DB lookups.
 * Used by testFlows.ts to send test emails without touching production tables.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { api } from "./_generated/api";
import { resend } from "./emails";
import { formatTime12h } from "./lib/time";

import {
  WelcomeEmail,
  AppointmentConfirmationEmail,
  AppointmentReminderEmail,
  AdminNewCustomerNotificationEmail,
  AdminReviewSubmittedNotificationEmail,
  CustomerReviewRequestEmailTemplate,
  CustomerAppointmentStatusEmailTemplate,
  AdminAppointmentNotificationEmailTemplate,
  AdminMileageLogRequiredNotificationEmailTemplate,
  AdminDepositPaidNotificationEmail,
} from "./emailTemplates";

function shouldSkipEmails(): boolean {
  return process.env.CONVEX_TEST === "true" || process.env.NODE_ENV === "test";
}

function siteUrl(): string {
  return process.env.CONVEX_SITE_URL || "https://patient-wombat-877.convex.site";
}

function logoUrl(): string {
  return `${siteUrl()}/BoldRiverCityMobileDetailingLogo.png`;
}

// Fake data constants for all test scenarios
const FAKE = {
  customerName: "Jane Doe (Test)",
  customerEmail: "test-customer@example.com",
  customerPhone: "(501) 555-0199",
  appointmentDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
  appointmentTime: "10:00",
  services: ["Full Detail", "Interior Clean"],
  location: "123 Test St, Little Rock, AR 72201",
  totalPrice: 250,
  duration: 90,
  depositAmount: 50,
  rating: 5,
  reviewComment: "Test review — excellent service! The car looks brand new.",
} as const;

/**
 * Render and send a test email for a given template.
 * All data is inline — no production table reads.
 */
export const sendTestEmail = internalAction({
  args: {
    template: v.string(),
    recipients: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const business = await ctx.runQuery(api.business.get);
    const businessName = business?.name || "River City Mobile Detailing";
    const from = `${businessName} <no-reply@notifications.rivercitymd.com>`;
    const logo = logoUrl();
    const site = siteUrl();
    const time12h = formatTime12h(FAKE.appointmentTime);

    let html: string;
    let subject: string;

    switch (args.template) {
      case "welcome": {
        html = await render(
          WelcomeEmail({
            userName: FAKE.customerName,
            businessName,
            dashboardUrl: `${site}/dashboard`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Welcome to ${businessName}!`;
        break;
      }

      case "appointment_confirmation": {
        html = await render(
          AppointmentConfirmationEmail({
            customerName: FAKE.customerName,
            businessName,
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            services: [...FAKE.services],
            location: FAKE.location,
            totalPrice: FAKE.totalPrice,
            appointmentId: "test-apt-id" as any,
            dashboardUrl: `${site}/dashboard/appointments`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Appointment Confirmed - ${FAKE.appointmentDate}`;
        break;
      }

      case "appointment_reminder": {
        html = await render(
          AppointmentReminderEmail({
            customerName: FAKE.customerName,
            businessName,
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            services: [...FAKE.services],
            location: FAKE.location,
            dashboardUrl: `${site}/dashboard/appointments`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Reminder: Your appointment is tomorrow - ${FAKE.appointmentDate}`;
        break;
      }

      case "customer_status_cancelled": {
        html = await render(
          CustomerAppointmentStatusEmailTemplate({
            customerName: FAKE.customerName,
            statusLabel: "Cancelled",
            summaryLine: "Your appointment has been cancelled.",
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            serviceNames: [...FAKE.services],
            location: FAKE.location,
            businessName,
            dashboardUrl: `${site}/dashboard/appointments`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Appointment Cancelled - ${FAKE.appointmentDate}`;
        break;
      }

      case "customer_status_rescheduled": {
        html = await render(
          CustomerAppointmentStatusEmailTemplate({
            customerName: FAKE.customerName,
            statusLabel: "Rescheduled",
            summaryLine: "Your appointment has been rescheduled.",
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            serviceNames: [...FAKE.services],
            location: FAKE.location,
            businessName,
            dashboardUrl: `${site}/dashboard/appointments`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Appointment Rescheduled - ${FAKE.appointmentDate}`;
        break;
      }

      case "customer_status_in_progress": {
        html = await render(
          CustomerAppointmentStatusEmailTemplate({
            customerName: FAKE.customerName,
            statusLabel: "In Progress",
            summaryLine: "Your detail appointment is now in progress.",
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            serviceNames: [...FAKE.services],
            location: FAKE.location,
            businessName,
            dashboardUrl: `${site}/dashboard/appointments`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Appointment In Progress - ${FAKE.appointmentDate}`;
        break;
      }

      case "customer_status_completed": {
        html = await render(
          CustomerAppointmentStatusEmailTemplate({
            customerName: FAKE.customerName,
            statusLabel: "Completed",
            summaryLine: "Your appointment has been completed.",
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            serviceNames: [...FAKE.services],
            location: FAKE.location,
            businessName,
            dashboardUrl: `${site}/dashboard/appointments`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Appointment Completed - ${FAKE.appointmentDate}`;
        break;
      }

      case "customer_review_request": {
        html = await render(
          CustomerReviewRequestEmailTemplate({
            customerName: FAKE.customerName,
            appointmentDate: FAKE.appointmentDate,
            serviceNames: [...FAKE.services],
            businessName,
            reviewUrl: `${site}/dashboard/reviews`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] How was your service? - ${businessName}`;
        break;
      }

      case "admin_new_customer": {
        html = await render(
          AdminNewCustomerNotificationEmail({
            userName: FAKE.customerName,
            userEmail: FAKE.customerEmail,
            userPhone: FAKE.customerPhone,
            userAddress: FAKE.location,
            vehicleCount: 2,
            signupDate: new Date().toLocaleDateString(),
            businessName,
            adminUrl: `${site}/admin/customers`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] New Customer: ${FAKE.customerName}`;
        break;
      }

      case "admin_deposit_paid": {
        html = await render(
          AdminDepositPaidNotificationEmail({
            customerName: FAKE.customerName,
            customerEmail: FAKE.customerEmail,
            customerPhone: FAKE.customerPhone,
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            serviceNames: [...FAKE.services],
            location: FAKE.location,
            depositAmount: FAKE.depositAmount,
            totalPrice: FAKE.totalPrice,
            businessName,
            appointmentUrl: `${site}/admin/appointments/test`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Deposit Paid - ${FAKE.customerName} - ${FAKE.appointmentDate}`;
        break;
      }

      case "admin_appointment_confirmed":
      case "admin_appointment_cancelled":
      case "admin_appointment_rescheduled":
      case "admin_appointment_started":
      case "admin_appointment_completed": {
        const actionMap: Record<string, string> = {
          admin_appointment_confirmed: "Appointment Confirmed",
          admin_appointment_cancelled: "Appointment Cancelled",
          admin_appointment_rescheduled: "Appointment Rescheduled",
          admin_appointment_started: "Appointment Started",
          admin_appointment_completed: "Appointment Completed",
        };
        const actionText = actionMap[args.template] || "Appointment Updated";

        html = await render(
          AdminAppointmentNotificationEmailTemplate({
            actionText,
            customerName: FAKE.customerName,
            customerEmail: FAKE.customerEmail,
            customerPhone: FAKE.customerPhone,
            appointmentDate: FAKE.appointmentDate,
            appointmentTime: time12h,
            duration: FAKE.duration,
            totalPrice: FAKE.totalPrice,
            serviceNames: [...FAKE.services],
            location: FAKE.location,
            status: "confirmed",
            businessName,
            adminUrl: `${site}/admin/appointments`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] ${actionText} - ${FAKE.appointmentDate} ${time12h}`;
        break;
      }

      case "admin_review_submitted": {
        const stars = "\u2B50".repeat(FAKE.rating);
        html = await render(
          AdminReviewSubmittedNotificationEmail({
            customerName: FAKE.customerName,
            customerEmail: FAKE.customerEmail,
            rating: FAKE.rating,
            stars,
            comment: FAKE.reviewComment,
            isPublic: true,
            appointmentDate: FAKE.appointmentDate,
            serviceNames: [...FAKE.services],
            businessName,
            adminUrl: `${site}/admin/reviews`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] New Review: ${stars} from ${FAKE.customerName}`;
        break;
      }

      case "admin_mileage_log_required": {
        html = await render(
          AdminMileageLogRequiredNotificationEmailTemplate({
            logId: "test-log-id" as any,
            logDate: FAKE.appointmentDate,
            businessPurpose: "Test - Mobile detailing service",
            destinationLabel: FAKE.location,
            appointmentInfo: `${FAKE.appointmentDate} ${time12h}`,
            customerInfo: `${FAKE.customerName} (${FAKE.customerEmail})`,
            businessName,
            adminUrl: `${site}/admin/logs`,
            logoUrl: logo,
          }),
        );
        subject = `[TEST] Mileage log required - ${FAKE.appointmentDate}`;
        break;
      }

      default:
        throw new Error(`Unknown test email template: ${args.template}`);
    }

    // Send to each recipient
    for (const to of args.recipients) {
      await resend.sendEmail(ctx, { from, to, subject, html });
    }
  },
});
