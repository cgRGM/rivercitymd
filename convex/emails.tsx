// IMPORTANT: this is a Convex Node Action
"use node";

/*
Email Setup Instructions:
1. Create a Resend account at https://resend.com
2. Add domain: rivercitymd.com
3. Verify DNS records (SPF, DKIM, DMARC) in your domain registrar
4. Configure webhook in Resend dashboard:
   - URL: https://your-convex-url.convex.site/resend-webhook
   - Events: email.sent, email.delivered, email.bounced, email.complained
5. Set environment variables in Vercel (Production):
   - RESEND_API_KEY=your_resend_api_key
   - RESEND_WEBHOOK_SECRET=your_webhook_secret
   - CONVEX_SITE_URL=https://your-app-url

 Email Functions:
 - sendWelcomeEmail: Sent when users complete onboarding
 - sendAppointmentConfirmationEmail: Sent when appointments are created
 - sendAppointmentReminderEmail: Sent 24h before appointment
 - sendAdminDepositPaidNotification: Sent when deposit is paid
 - sendAdminAppointmentNotification: Sent to admin for appointment changes

All emails are sent from: no-reply@notifications.rivercitymd.com
All emails use professional templates with business branding.
*/

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { components, api, internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { formatTime12h } from "./lib/time";

// Import all template components from the shared file
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

// Initialize Resend component
// Use test mode for development, production mode when env vars are set
const hasApiKey = !!process.env.RESEND_API_KEY;
export const resend: Resend = new Resend(components.resend, {
  testMode: !hasApiKey,
});

function shouldSkipEmails(): boolean {
  return process.env.CONVEX_TEST === "true" || process.env.NODE_ENV === "test";
}

function siteUrl(): string {
  return process.env.CONVEX_SITE_URL || "https://patient-wombat-877.convex.site";
}

function logoUrl(): string {
  return `${siteUrl()}/BoldRiverCityMobileDetailingLogo.png`;
}

// --- Helper to get service names for an appointment ---
async function getServiceNames(ctx: any, serviceIds: any[]): Promise<string[]> {
  const services = await Promise.all(
    serviceIds.map((id: any) =>
      ctx.runQuery(internal.services.getServiceById, { serviceId: id }),
    ),
  );
  return services
    .filter((s: any) => s !== null)
    .map((s: any) => s.name);
}

function formatLocation(location: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): string {
  return `${location.street}, ${location.city}, ${location.state} ${location.zip}`;
}

// --- Action Handlers ---

// Send Welcome Email
export const sendWelcomeEmail = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: args.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const html = await render(
      WelcomeEmail({
        userName: user.name || "Valued Customer",
        businessName: business.name,
        dashboardUrl: `${siteUrl()}/dashboard`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: user.email,
      subject: `Welcome to ${business.name}!`,
      html,
    });
  },
});

// Send Appointment Confirmation Email
export const sendAppointmentConfirmationEmail = internalAction({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );
    if (!appointment) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const serviceNames = await getServiceNames(ctx, appointment.serviceIds);

    const html = await render(
      AppointmentConfirmationEmail({
        customerName: user.name || "Valued Customer",
        businessName: business.name,
        appointmentDate: appointment.scheduledDate,
        appointmentTime: formatTime12h(appointment.scheduledTime),
        services: serviceNames,
        location: formatLocation(appointment.location),
        totalPrice: appointment.totalPrice,
        appointmentId: args.appointmentId,
        dashboardUrl: `${siteUrl()}/dashboard/appointments`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: user.email,
      subject: `Appointment Confirmed - ${appointment.scheduledDate}`,
      html,
    });
  },
});

// Send Invoice Email

// Send Appointment Reminder Email (24h before)
export const sendAppointmentReminderEmail = internalAction({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );
    if (!appointment) return;

    // Defensive: skip if appointment is no longer active
    if (
      appointment.status === "cancelled" ||
      appointment.status === "rescheduled"
    ) {
      return;
    }

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const serviceNames = await getServiceNames(ctx, appointment.serviceIds);

    const html = await render(
      AppointmentReminderEmail({
        customerName: user.name || "Valued Customer",
        businessName: business.name,
        appointmentDate: appointment.scheduledDate,
        appointmentTime: formatTime12h(appointment.scheduledTime),
        services: serviceNames,
        location: formatLocation(appointment.location),
        dashboardUrl: `${siteUrl()}/dashboard/appointments`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: user.email,
      subject: `Reminder: Your appointment is tomorrow - ${appointment.scheduledDate}`,
      html,
    });
  },
});

// Send Admin Notification for Deposit Paid
export const sendAdminDepositPaidNotification = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );
    if (!appointment) return;

    const invoice = await ctx.runQuery(internal.invoices.getByIdInternal, {
      invoiceId: args.invoiceId,
    });

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const serviceNames = await getServiceNames(ctx, appointment.serviceIds);

    const html = await render(
      AdminDepositPaidNotificationEmail({
        customerName: user.name || "N/A",
        customerEmail: user.email || "N/A",
        customerPhone: user.phone || "N/A",
        appointmentDate: appointment.scheduledDate,
        appointmentTime: formatTime12h(appointment.scheduledTime),
        serviceNames,
        location: formatLocation(appointment.location),
        depositAmount: invoice?.depositAmount || 0,
        totalPrice: appointment.totalPrice,
        businessName: business.name,
        appointmentUrl: `${siteUrl()}/admin/appointments/${args.appointmentId}`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: "dustin@rivercitymd.com",
      subject: `Deposit Paid - ${user.name || user.email} - ${appointment.scheduledDate}`,
      html,
    });
  },
});

// Send Admin Notification for New Customer (after onboarding complete)
export const sendAdminNewCustomerNotification = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: args.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const vehicles = await ctx.runQuery(internal.vehicles.listByUserInternal, {
      userId: args.userId,
    });

    const html = await render(
      AdminNewCustomerNotificationEmail({
        userName: user.name || "N/A",
        userEmail: user.email || "N/A",
        userPhone: user.phone || "N/A",
        userAddress: user.address
          ? `${user.address.street}, ${user.address.city}, ${user.address.state} ${user.address.zip}`
          : undefined,
        vehicleCount: vehicles.length,
        signupDate: new Date().toLocaleDateString(),
        businessName: business.name,
        adminUrl: `${siteUrl()}/admin/customers`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: "dustin@rivercitymd.com",
      subject: `New Customer: ${user.name || user.email}`,
      html,
    });
  },
});

// Send Admin Notification for Review Submitted
export const sendAdminReviewSubmittedNotification = internalAction({
  args: {
    reviewId: v.id("reviews"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const review = await ctx.runQuery(internal.reviews.getByIdInternal, {
      reviewId: args.reviewId,
    });
    if (!review) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: review.userId,
    });
    if (!user) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: review.appointmentId },
    );
    if (!appointment) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const serviceNames = await getServiceNames(ctx, appointment.serviceIds);
    const stars = "\u2B50".repeat(review.rating);

    const html = await render(
      AdminReviewSubmittedNotificationEmail({
        customerName: user.name || "N/A",
        customerEmail: user.email || "N/A",
        rating: review.rating,
        stars,
        comment: review.comment,
        isPublic: review.isPublic,
        appointmentDate: appointment.scheduledDate,
        serviceNames,
        businessName: business.name,
        adminUrl: `${siteUrl()}/admin/reviews`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: "dustin@rivercitymd.com",
      subject: `New Review: ${stars} from ${user.name || user.email}`,
      html,
    });
  },
});

// Send Customer Review Request Email (after appointment completed)
export const sendCustomerReviewRequestEmail = internalAction({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );
    if (!appointment) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const serviceNames = await getServiceNames(ctx, appointment.serviceIds);

    const html = await render(
      CustomerReviewRequestEmailTemplate({
        customerName: user.name || "Valued Customer",
        appointmentDate: appointment.scheduledDate,
        serviceNames,
        businessName: business.name,
        reviewUrl: `${siteUrl()}/dashboard/reviews`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: user.email,
      subject: `How was your service? - ${business.name}`,
      html,
    });
  },
});

export const sendCustomerAppointmentStatusEmail = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    status: v.union(
      v.literal("confirmed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );
    if (!appointment) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const serviceNames = await getServiceNames(ctx, appointment.serviceIds);

    const statusLabel =
      args.status === "in_progress"
        ? "In Progress"
        : args.status === "rescheduled"
          ? "Rescheduled"
          : args.status === "cancelled"
            ? "Cancelled"
            : args.status === "confirmed"
              ? "Confirmed"
              : "Completed";

    const summaryLine =
      args.status === "cancelled"
        ? "Your appointment has been cancelled."
        : args.status === "rescheduled"
          ? "Your appointment has been rescheduled."
          : args.status === "in_progress"
            ? "Your detail appointment is now in progress."
            : args.status === "completed"
              ? "Your appointment has been completed."
              : "Your appointment has been confirmed.";

    const html = await render(
      CustomerAppointmentStatusEmailTemplate({
        customerName: user.name || "Valued Customer",
        statusLabel,
        summaryLine,
        appointmentDate: appointment.scheduledDate,
        appointmentTime: formatTime12h(appointment.scheduledTime),
        serviceNames,
        location: formatLocation(appointment.location),
        businessName: business.name,
        dashboardUrl: `${siteUrl()}/dashboard/appointments`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: user.email,
      subject: `Appointment ${statusLabel} - ${appointment.scheduledDate}`,
      html,
    });
  },
});

// Send Admin Notification for New Appointment
export const sendAdminAppointmentNotification = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    action: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("cancelled"),
      v.literal("confirmed"),
      v.literal("rescheduled"),
      v.literal("started"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      { appointmentId: args.appointmentId },
    );
    if (!appointment) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const serviceNames = await getServiceNames(ctx, appointment.serviceIds);

    const actionText =
      args.action === "created"
        ? "New Appointment Booked"
        : args.action === "confirmed"
          ? "Appointment Confirmed"
          : args.action === "updated"
            ? "Appointment Updated"
            : args.action === "cancelled"
              ? "Appointment Cancelled"
              : args.action === "rescheduled"
                ? "Appointment Rescheduled"
                : args.action === "started"
                  ? "Appointment Started"
                  : "Appointment Completed";

    const formattedTime = formatTime12h(appointment.scheduledTime);

    const html = await render(
      AdminAppointmentNotificationEmailTemplate({
        actionText,
        customerName: user.name || "N/A",
        customerEmail: user.email || "N/A",
        customerPhone: user.phone || "N/A",
        appointmentDate: appointment.scheduledDate,
        appointmentTime: formattedTime,
        duration: appointment.duration,
        totalPrice: appointment.totalPrice,
        serviceNames,
        location: formatLocation(appointment.location),
        status: appointment.status,
        notes: appointment.notes,
        businessName: business.name,
        adminUrl: `${siteUrl()}/admin/appointments`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: "dustin@rivercitymd.com",
      subject: `${actionText} - ${appointment.scheduledDate} ${formattedTime}`,
      html,
    });
  },
});

export const sendAdminMileageLogRequiredNotification = internalAction({
  args: {
    tripLogId: v.id("tripLogs"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const tripLog = await ctx.runQuery(internal.tripLogs.getByIdInternal, {
      tripLogId: args.tripLogId,
    });
    if (!tripLog) return;

    const appointment = tripLog.appointmentId
      ? await ctx.runQuery(internal.appointments.getByIdInternal, {
          appointmentId: tripLog.appointmentId,
        })
      : null;
    const customer = appointment
      ? await ctx.runQuery(internal.users.getByIdInternal, {
          userId: appointment.userId,
        })
      : null;
    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const destination = tripLog.stops[0];
    const destinationLabel =
      destination?.addressLabel ||
      [
        destination?.street,
        destination?.city,
        destination?.state,
        destination?.postalCode,
      ]
        .filter(Boolean)
        .join(", ") ||
      "Not set";

    const appointmentInfo = appointment
      ? `${appointment.scheduledDate} ${formatTime12h(appointment.scheduledTime)}`
      : undefined;

    const customerInfo = customer
      ? `${customer.name || "Unknown"} (${customer.email || "no email"})`
      : undefined;

    const html = await render(
      AdminMileageLogRequiredNotificationEmailTemplate({
        logId: tripLog._id,
        logDate: tripLog.logDate,
        businessPurpose: tripLog.businessPurpose || "Not set",
        destinationLabel,
        appointmentInfo,
        customerInfo,
        businessName: business.name,
        adminUrl: `${siteUrl()}/admin/logs`,
        logoUrl: logoUrl(),
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <no-reply@notifications.rivercitymd.com>`,
      to: "dustin@rivercitymd.com",
      subject: `Mileage log required - ${tripLog.logDate}`,
      html,
    });
  },
});
