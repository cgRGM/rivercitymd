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
 - sendAdminAppointmentNotification: Sent to admin for appointment changes

All emails are sent from: notifications@rivercitymd.com
All emails use professional templates with business branding.
*/

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Heading,
  Hr,
} from "@react-email/components";
import { components, api, internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";

// Initialize Resend component
// Use test mode for development, production mode when env vars are set
const hasApiKey = !!process.env.RESEND_API_KEY;
export const resend: Resend = new Resend(components.resend, {
  testMode: !hasApiKey, // Test mode when no API key, production mode when API key is set
});

function shouldSkipEmails(): boolean {
  return process.env.CONVEX_TEST === "true" || process.env.NODE_ENV === "test";
}

// Welcome Email Template Component
interface WelcomeEmailProps {
  userName: string;
  businessName: string;
}

function WelcomeEmail({ userName, businessName }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#f6f6f6",
          padding: "20px",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Heading
              style={{ color: "#333", fontSize: "24px", marginBottom: "10px" }}
            >
              Welcome to {businessName}!
            </Heading>
            <Text
              style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}
            >
              Hi {userName}, thank you for choosing {businessName} for your
              mobile detailing needs.
            </Text>
          </Section>

          <Section style={{ marginBottom: "30px" }}>
            <Text
              style={{
                color: "#333",
                fontSize: "16px",
                lineHeight: "1.6",
                marginBottom: "20px",
              }}
            >
              We're excited to provide you with premium mobile car detailing
              services right at your location. Our professional detailers will
              come to you, saving you time and hassle.
            </Text>

            <Text
              style={{
                color: "#333",
                fontSize: "16px",
                lineHeight: "1.6",
                marginBottom: "20px",
              }}
            >
              Here's what you can do next:
            </Text>

            <ul
              style={{
                color: "#666",
                fontSize: "14px",
                lineHeight: "1.6",
                paddingLeft: "20px",
              }}
            >
              <li>Complete your profile with your vehicle information</li>
              <li>Book your first detailing appointment</li>
              <li>View your service history and invoices</li>
              <li>Leave reviews for completed services</li>
            </ul>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button
              href={`${process.env.CONVEX_SITE_URL}/dashboard`}
              style={{
                backgroundColor: "#007bff",
                color: "#ffffff",
                padding: "12px 24px",
                textDecoration: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              Book Your First Service
            </Button>
          </Section>

          <Hr style={{ borderColor: "#eee", margin: "20px 0" }} />

          <Section style={{ textAlign: "center" }}>
            <Text
              style={{ color: "#999", fontSize: "12px", lineHeight: "1.4" }}
            >
              Questions? Contact us at support@
              {businessName.toLowerCase().replace(/\s+/g, "")}.com
            </Text>
            <Text
              style={{ color: "#999", fontSize: "12px", marginTop: "10px" }}
            >
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

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
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
      to: user.email,
      subject: `Welcome to ${business.name}!`,
      html,
    });
  },
});

// Appointment Confirmation Email Template Component
interface AppointmentConfirmationProps {
  customerName: string;
  businessName: string;
  appointmentDate: string;
  appointmentTime: string;
  services: string[];
  location: string;
  totalPrice: number;
  appointmentId: string;
}

function AppointmentConfirmationEmail(props: AppointmentConfirmationProps) {
  const {
    customerName,
    businessName,
    appointmentDate,
    appointmentTime,
    services,
    location,
    totalPrice,
    appointmentId,
  } = props;

  return (
    <Html>
      <Head />
      <Body
        style={{
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#f6f6f6",
          padding: "20px",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Heading
              style={{ color: "#333", fontSize: "24px", marginBottom: "10px" }}
            >
              Appointment Confirmed!
            </Heading>
            <Text
              style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}
            >
              Hi {customerName}, your detailing appointment has been confirmed.
            </Text>
          </Section>

          <Section
            style={{
              marginBottom: "30px",
              backgroundColor: "#f8f9fa",
              padding: "20px",
              borderRadius: "6px",
            }}
          >
            <Heading
              style={{ color: "#333", fontSize: "18px", marginBottom: "15px" }}
            >
              Appointment Details
            </Heading>

            <Text
              style={{ color: "#333", fontSize: "14px", marginBottom: "8px" }}
            >
              <strong>Date:</strong> {appointmentDate}
            </Text>
            <Text
              style={{ color: "#333", fontSize: "14px", marginBottom: "8px" }}
            >
              <strong>Time:</strong> {appointmentTime}
            </Text>
            <Text
              style={{ color: "#333", fontSize: "14px", marginBottom: "8px" }}
            >
              <strong>Location:</strong> {location}
            </Text>
            <Text
              style={{ color: "#333", fontSize: "14px", marginBottom: "15px" }}
            >
              <strong>Services:</strong>
            </Text>
            <ul
              style={{
                color: "#666",
                fontSize: "14px",
                lineHeight: "1.6",
                paddingLeft: "20px",
              }}
            >
              {services.map((service, index) => (
                <li key={index}>{service}</li>
              ))}
            </ul>
            <Text
              style={{
                color: "#333",
                fontSize: "16px",
                marginTop: "15px",
                fontWeight: "bold",
              }}
            >
              Total: ${totalPrice.toFixed(2)}
            </Text>
          </Section>

          <Section style={{ marginBottom: "30px" }}>
            <Text
              style={{
                color: "#333",
                fontSize: "16px",
                lineHeight: "1.6",
                marginBottom: "20px",
              }}
            >
              Our professional detailer will arrive at your location at the
              scheduled time. Please ensure your vehicle is accessible and ready
              for service.
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button
              href={`${process.env.CONVEX_SITE_URL}/dashboard/appointments`}
              style={{
                backgroundColor: "#28a745",
                color: "#ffffff",
                padding: "12px 24px",
                textDecoration: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "bold",
                marginRight: "10px",
              }}
            >
              View Appointment
            </Button>
          </Section>

          <Hr style={{ borderColor: "#eee", margin: "20px 0" }} />

          <Section style={{ textAlign: "center" }}>
            <Text
              style={{ color: "#999", fontSize: "12px", lineHeight: "1.4" }}
            >
              Appointment ID: {appointmentId}
            </Text>
            <Text
              style={{ color: "#999", fontSize: "12px", marginTop: "10px" }}
            >
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Send Appointment Confirmation Email
export const sendAppointmentConfirmationEmail = internalAction({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      {
        appointmentId: args.appointmentId,
      },
    );
    if (!appointment) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    // Get services
    const services = await Promise.all(
      appointment.serviceIds.map((id: any) =>
        ctx.runQuery(internal.services.getServiceById, { serviceId: id }),
      ),
    );
    const serviceNames = services
      .filter((s: any) => s !== null)
      .map((s: any) => s.name);

    const html = await render(
      AppointmentConfirmationEmail({
        customerName: user.name || "Valued Customer",
        businessName: business.name,
        appointmentDate: appointment.scheduledDate,
        appointmentTime: appointment.scheduledTime,
        services: serviceNames,
        location: `${appointment.location.street}, ${appointment.location.city}, ${appointment.location.state} ${appointment.location.zip}`,
        totalPrice: appointment.totalPrice,
        appointmentId: args.appointmentId,
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
      to: user.email,
      subject: `Appointment Confirmed - ${appointment.scheduledDate}`,
      html,
    });
  },
});

// Send Invoice Email

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

    // Get user's vehicles count (query directly since we're in an internalAction)
    const vehicles = await ctx.runQuery(internal.vehicles.listByUserInternal, {
      userId: args.userId,
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">New Customer Signed Up</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Customer Details</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${user.name || "N/A"}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email || "N/A"}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${user.phone || "N/A"}</p>
          ${user.address ? `<p style="margin: 5px 0;"><strong>Address:</strong> ${user.address.street}, ${user.address.city}, ${user.address.state} ${user.address.zip}</p>` : ""}
          <p style="margin: 5px 0;"><strong>Vehicles:</strong> ${vehicles.length} vehicle${vehicles.length !== 1 ? "s" : ""}</p>
          <p style="margin: 5px 0;"><strong>Signup Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CONVEX_SITE_URL || "https://patient-wombat-877.convex.site"}/admin/customers"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Customer in Admin Dashboard
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from ${business.name}.
        </p>
      </div>
    `;

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
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

    // Use internal query or direct db access since this is an internalAction
    const review = await ctx.runQuery(internal.reviews.getByIdInternal, {
      reviewId: args.reviewId,
    });
    if (!review) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: review.userId,
    });
    if (!user) return;

    const appointment = await ctx.runQuery(internal.appointments.getByIdInternal, {
      appointmentId: review.appointmentId,
    });
    if (!appointment) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    // Get services
    const services = await Promise.all(
      appointment.serviceIds.map((id: any) =>
        ctx.runQuery(internal.services.getServiceById, { serviceId: id }),
      ),
    );
    const serviceNames = services
      .filter((s: any) => s !== null)
      .map((s: any) => s.name);

    const stars = "⭐".repeat(review.rating);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">New Review Submitted</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Review Details</h3>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${user.name || "N/A"} (${user.email || "N/A"})</p>
          <p style="margin: 5px 0;"><strong>Rating:</strong> ${stars} (${review.rating}/5)</p>
          ${review.comment ? `<p style="margin: 5px 0;"><strong>Comment:</strong> ${review.comment}</p>` : `<p style="margin: 5px 0;"><strong>Comment:</strong> No comment provided</p>`}
          <p style="margin: 5px 0;"><strong>Public:</strong> ${review.isPublic ? "Yes" : "No"}</p>
          <p style="margin: 5px 0;"><strong>Appointment Date:</strong> ${appointment.scheduledDate}</p>
          <p style="margin: 5px 0;"><strong>Services:</strong> ${serviceNames.join(", ")}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CONVEX_SITE_URL || "https://patient-wombat-877.convex.site"}/admin/reviews"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Review in Admin Dashboard
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from ${business.name}.
        </p>
      </div>
    `;

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
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
      {
        appointmentId: args.appointmentId,
      },
    );
    if (!appointment) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    // Get services
    const services = await Promise.all(
      appointment.serviceIds.map((id: any) =>
        ctx.runQuery(internal.services.getServiceById, { serviceId: id }),
      ),
    );
    const serviceNames = services
      .filter((s: any) => s !== null)
      .map((s: any) => s.name);

    const reviewUrl = `${process.env.CONVEX_SITE_URL || "https://patient-wombat-877.convex.site"}/dashboard/reviews`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Thank You for Choosing ${business.name}!</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          We hope you enjoyed your service on <strong>${appointment.scheduledDate}</strong>!
        </p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Service Details</h3>
          <p style="margin: 5px 0;"><strong>Services:</strong> ${serviceNames.join(", ")}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${appointment.scheduledDate}</p>
        </div>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Your feedback helps us improve our services. We'd love to hear about your experience!
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${reviewUrl}"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Leave a Review
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated email from ${business.name}.
        </p>
      </div>
    `;

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
      to: user.email,
      subject: `How was your service? - ${business.name}`,
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
    ),
  },
  handler: async (ctx, args) => {
    if (shouldSkipEmails()) return;

    const appointment = await ctx.runQuery(
      internal.appointments.getByIdInternal,
      {
        appointmentId: args.appointmentId,
      },
    );
    if (!appointment) return;

    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    if (!user) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    // Get services
    const services = await Promise.all(
      appointment.serviceIds.map((id: any) =>
        ctx.runQuery(internal.services.getServiceById, { serviceId: id }),
      ),
    );
    const serviceNames = services
      .filter((s: any) => s !== null)
      .map((s: any) => s.name);

    const actionText =
      args.action === "created"
        ? "New Appointment Booked"
        : args.action === "updated"
          ? "Appointment Updated"
          : "Appointment Cancelled";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">${actionText}</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Appointment Details</h3>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${user.name || "N/A"} (${user.email || "N/A"})</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${user.phone || "N/A"}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${appointment.scheduledDate}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${appointment.scheduledTime}</p>
          <p style="margin: 5px 0;"><strong>Duration:</strong> ${appointment.duration} minutes</p>
          <p style="margin: 5px 0;"><strong>Total Price:</strong> $${appointment.totalPrice.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Services:</strong> ${serviceNames.join(", ")}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${appointment.location.street}, ${appointment.location.city}, ${appointment.location.state} ${appointment.location.zip}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> ${appointment.status}</p>
          ${appointment.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${appointment.notes}</p>` : ""}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CONVEX_SITE_URL}/admin/appointments"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View in Admin Dashboard
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from ${business.name}.
        </p>
      </div>
    `;

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
      to: "dustin@rivercitymd.com",
      subject: `${actionText} - ${appointment.scheduledDate} ${appointment.scheduledTime}`,
      html,
    });
  },
});
