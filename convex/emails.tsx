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
import { formatTime12h } from "./lib/time";

// Initialize Resend component
// Use test mode for development, production mode when env vars are set
const hasApiKey = !!process.env.RESEND_API_KEY;
export const resend: Resend = new Resend(components.resend, {
  testMode: !hasApiKey, // Test mode when no API key, production mode when API key is set
});

function shouldSkipEmails(): boolean {
  return process.env.CONVEX_TEST === "true" || process.env.NODE_ENV === "test";
}

// Shared email styles
const emailStyles = {
  body: {
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f6f6f6",
    padding: "20px",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    padding: "20px",
    borderRadius: "8px",
  },
  heading: {
    color: "#333",
    fontSize: "24px",
    marginBottom: "10px",
  },
  subheading: {
    color: "#333",
    fontSize: "18px",
    marginBottom: "15px",
  },
  text: {
    color: "#666",
    fontSize: "16px",
    lineHeight: "1.5" as const,
  },
  textBody: {
    color: "#333",
    fontSize: "16px",
    lineHeight: "1.6" as const,
    marginBottom: "20px",
  },
  detailBox: {
    marginBottom: "30px",
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "6px",
  },
  detailRow: {
    color: "#333",
    fontSize: "14px",
    marginBottom: "8px",
  },
  primaryButton: {
    backgroundColor: "#007bff",
    color: "#ffffff",
    padding: "12px 24px",
    textDecoration: "none" as const,
    borderRadius: "4px",
    fontSize: "16px",
    fontWeight: "bold" as const,
  },
  successButton: {
    backgroundColor: "#28a745",
    color: "#ffffff",
    padding: "12px 24px",
    textDecoration: "none" as const,
    borderRadius: "4px",
    fontSize: "16px",
    fontWeight: "bold" as const,
  },
  hr: {
    borderColor: "#eee",
    margin: "20px 0",
  },
  footer: {
    color: "#999",
    fontSize: "12px",
    lineHeight: "1.4" as const,
  },
  serviceList: {
    color: "#666",
    fontSize: "14px",
    lineHeight: "1.6" as const,
    paddingLeft: "20px",
  },
} as const;

function siteUrl(): string {
  return process.env.CONVEX_SITE_URL || "https://patient-wombat-877.convex.site";
}

// --- Email Template Components ---

// Welcome Email
interface WelcomeEmailProps {
  userName: string;
  businessName: string;
}

function WelcomeEmail({ userName, businessName }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Heading style={emailStyles.heading}>
              Welcome to {businessName}!
            </Heading>
            <Text style={emailStyles.text}>
              Hi {userName}, thank you for choosing {businessName} for your
              mobile detailing needs.
            </Text>
          </Section>

          <Section style={{ marginBottom: "30px" }}>
            <Text style={emailStyles.textBody}>
              We're excited to provide you with premium mobile car detailing
              services right at your location. Our professional detailers will
              come to you, saving you time and hassle.
            </Text>
            <Text style={emailStyles.textBody}>
              Here's what you can do next:
            </Text>
            <ul style={emailStyles.serviceList}>
              <li>Complete your profile with your vehicle information</li>
              <li>Book your first detailing appointment</li>
              <li>View your service history and invoices</li>
              <li>Leave reviews for completed services</li>
            </ul>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button
              href={`${siteUrl()}/dashboard`}
              style={emailStyles.primaryButton}
            >
              Book Your First Service
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              Questions? Contact us at support@
              {businessName.toLowerCase().replace(/\s+/g, "")}.com
            </Text>
            <Text style={{ ...emailStyles.footer, marginTop: "10px" }}>
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Appointment Confirmation Email
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
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Heading style={emailStyles.heading}>
              Appointment Confirmed!
            </Heading>
            <Text style={emailStyles.text}>
              Hi {customerName}, your detailing appointment has been confirmed.
            </Text>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>
              Appointment Details
            </Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Date:</strong> {appointmentDate}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Time:</strong> {appointmentTime}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Location:</strong> {location}
            </Text>
            <Text style={{ ...emailStyles.detailRow, marginBottom: "15px" }}>
              <strong>Services:</strong>
            </Text>
            <ul style={emailStyles.serviceList}>
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
            <Text style={emailStyles.textBody}>
              Our professional detailer will arrive at your location at the
              scheduled time. Please ensure your vehicle is accessible and ready
              for service.
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button
              href={`${siteUrl()}/dashboard/appointments`}
              style={emailStyles.successButton}
            >
              View Appointment
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              Appointment ID: {appointmentId}
            </Text>
            <Text style={{ ...emailStyles.footer, marginTop: "10px" }}>
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Appointment Reminder Email (24h before)
interface AppointmentReminderProps {
  customerName: string;
  businessName: string;
  appointmentDate: string;
  appointmentTime: string;
  services: string[];
  location: string;
}

function AppointmentReminderEmail(props: AppointmentReminderProps) {
  const {
    customerName,
    businessName,
    appointmentDate,
    appointmentTime,
    services,
    location,
  } = props;

  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Heading style={emailStyles.heading}>
              Your Appointment is Tomorrow!
            </Heading>
            <Text style={emailStyles.text}>
              Hi {customerName}, this is a friendly reminder that your detailing
              appointment is coming up tomorrow.
            </Text>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>
              Appointment Details
            </Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Date:</strong> {appointmentDate}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Time:</strong> {appointmentTime}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Location:</strong> {location}
            </Text>
            <Text style={{ ...emailStyles.detailRow, marginBottom: "15px" }}>
              <strong>Services:</strong>
            </Text>
            <ul style={emailStyles.serviceList}>
              {services.map((service, index) => (
                <li key={index}>{service}</li>
              ))}
            </ul>
          </Section>

          <Section style={{ marginBottom: "30px" }}>
            <Text style={emailStyles.textBody}>
              Please ensure your vehicle is accessible and ready for service at
              the scheduled time. Our professional detailer will arrive at your
              location.
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button
              href={`${siteUrl()}/dashboard/appointments`}
              style={emailStyles.primaryButton}
            >
              View Appointment
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              This is an automated reminder from {businessName}.
            </Text>
            <Text style={{ ...emailStyles.footer, marginTop: "10px" }}>
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Admin New Customer Notification Email
interface AdminNewCustomerNotificationEmailProps {
  userName: string;
  userEmail: string;
  userPhone: string;
  userAddress?: string;
  vehicleCount: number;
  signupDate: string;
  businessName: string;
  adminUrl: string;
}

function AdminNewCustomerNotificationEmail(
  props: AdminNewCustomerNotificationEmailProps,
) {
  const {
    userName,
    userEmail,
    userPhone,
    userAddress,
    vehicleCount,
    signupDate,
    businessName,
    adminUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ marginBottom: "20px" }}>
            <Heading style={emailStyles.heading}>
              New Customer Signed Up
            </Heading>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>Customer Details</Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Name:</strong> {userName}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Email:</strong> {userEmail}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Phone:</strong> {userPhone}
            </Text>
            {userAddress ? (
              <Text style={emailStyles.detailRow}>
                <strong>Address:</strong> {userAddress}
              </Text>
            ) : null}
            <Text style={emailStyles.detailRow}>
              <strong>Vehicles:</strong> {vehicleCount} vehicle
              {vehicleCount !== 1 ? "s" : ""}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Signup Date:</strong> {signupDate}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button href={adminUrl} style={emailStyles.primaryButton}>
              View Customer in Admin Dashboard
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              This is an automated notification from {businessName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Admin Review Submitted Notification Email
interface AdminReviewSubmittedNotificationEmailProps {
  customerName: string;
  customerEmail: string;
  rating: number;
  stars: string;
  comment?: string;
  isPublic: boolean;
  appointmentDate: string;
  serviceNames: string[];
  businessName: string;
  adminUrl: string;
}

function AdminReviewSubmittedNotificationEmail(
  props: AdminReviewSubmittedNotificationEmailProps,
) {
  const {
    customerName,
    customerEmail,
    rating,
    stars,
    comment,
    isPublic,
    appointmentDate,
    serviceNames,
    businessName,
    adminUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ marginBottom: "20px" }}>
            <Heading style={emailStyles.heading}>New Review Submitted</Heading>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>Review Details</Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Customer:</strong> {customerName} ({customerEmail})
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Rating:</strong> {stars} ({rating}/5)
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Comment:</strong>{" "}
              {comment || "No comment provided"}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Public:</strong> {isPublic ? "Yes" : "No"}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Appointment Date:</strong> {appointmentDate}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Services:</strong> {serviceNames.join(", ")}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button href={adminUrl} style={emailStyles.primaryButton}>
              View Review in Admin Dashboard
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              This is an automated notification from {businessName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Customer Review Request Email
interface CustomerReviewRequestEmailProps {
  customerName: string;
  appointmentDate: string;
  serviceNames: string[];
  businessName: string;
  reviewUrl: string;
}

function CustomerReviewRequestEmailTemplate(
  props: CustomerReviewRequestEmailProps,
) {
  const { customerName, appointmentDate, serviceNames, businessName, reviewUrl } =
    props;

  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ marginBottom: "20px" }}>
            <Heading style={emailStyles.heading}>
              Thank You for Choosing {businessName}!
            </Heading>
            <Text style={emailStyles.text}>
              Hi {customerName}, we hope you enjoyed your service on{" "}
              <strong>{appointmentDate}</strong>!
            </Text>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>Service Details</Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Services:</strong> {serviceNames.join(", ")}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Date:</strong> {appointmentDate}
            </Text>
          </Section>

          <Section style={{ marginBottom: "30px" }}>
            <Text style={emailStyles.textBody}>
              Your feedback helps us improve our services. We'd love to hear
              about your experience!
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button href={reviewUrl} style={emailStyles.primaryButton}>
              Leave a Review
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              This is an automated email from {businessName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Customer Appointment Status Email
interface CustomerAppointmentStatusEmailProps {
  customerName: string;
  statusLabel: string;
  summaryLine: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceNames: string[];
  location: string;
  businessName: string;
  dashboardUrl: string;
}

function CustomerAppointmentStatusEmailTemplate(
  props: CustomerAppointmentStatusEmailProps,
) {
  const {
    customerName,
    statusLabel,
    summaryLine,
    appointmentDate,
    appointmentTime,
    serviceNames,
    location,
    businessName,
    dashboardUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ marginBottom: "20px" }}>
            <Heading style={emailStyles.heading}>
              Appointment {statusLabel}
            </Heading>
            <Text style={emailStyles.text}>
              Hi {customerName}, {summaryLine}
            </Text>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>
              Appointment Details
            </Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Date:</strong> {appointmentDate}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Time:</strong> {appointmentTime}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Services:</strong> {serviceNames.join(", ")}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Location:</strong> {location}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button href={dashboardUrl} style={emailStyles.primaryButton}>
              View Appointments
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              This is an automated email from {businessName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Admin Appointment Notification Email
interface AdminAppointmentNotificationEmailProps {
  actionText: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  totalPrice: number;
  serviceNames: string[];
  location: string;
  status: string;
  notes?: string;
  businessName: string;
  adminUrl: string;
}

function AdminAppointmentNotificationEmailTemplate(
  props: AdminAppointmentNotificationEmailProps,
) {
  const {
    actionText,
    customerName,
    customerEmail,
    customerPhone,
    appointmentDate,
    appointmentTime,
    duration,
    totalPrice,
    serviceNames,
    location,
    status,
    notes,
    businessName,
    adminUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ marginBottom: "20px" }}>
            <Heading style={emailStyles.heading}>{actionText}</Heading>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>
              Appointment Details
            </Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Customer:</strong> {customerName} ({customerEmail})
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Phone:</strong> {customerPhone}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Date:</strong> {appointmentDate}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Time:</strong> {appointmentTime}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Duration:</strong> {duration} minutes
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Total Price:</strong> ${totalPrice.toFixed(2)}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Services:</strong> {serviceNames.join(", ")}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Location:</strong> {location}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Status:</strong> {status}
            </Text>
            {notes ? (
              <Text style={emailStyles.detailRow}>
                <strong>Notes:</strong> {notes}
              </Text>
            ) : null}
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button href={adminUrl} style={emailStyles.primaryButton}>
              View in Admin Dashboard
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              This is an automated notification from {businessName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Admin Mileage Log Required Notification Email
interface AdminMileageLogRequiredNotificationEmailProps {
  logId: string;
  logDate: string;
  businessPurpose: string;
  destinationLabel: string;
  appointmentInfo?: string;
  customerInfo?: string;
  businessName: string;
  adminUrl: string;
}

function AdminMileageLogRequiredNotificationEmailTemplate(
  props: AdminMileageLogRequiredNotificationEmailProps,
) {
  const {
    logId,
    logDate,
    businessPurpose,
    destinationLabel,
    appointmentInfo,
    customerInfo,
    businessName,
    adminUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={{ marginBottom: "20px" }}>
            <Heading style={emailStyles.heading}>Mileage Log Required</Heading>
            <Text style={emailStyles.text}>
              A completed appointment needs a trip and expense log for tax
              records.
            </Text>
          </Section>

          <Section style={emailStyles.detailBox}>
            <Heading style={emailStyles.subheading}>Log Details</Heading>
            <Text style={emailStyles.detailRow}>
              <strong>Log ID:</strong> {logId}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Log Date:</strong> {logDate}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Business Purpose:</strong> {businessPurpose}
            </Text>
            <Text style={emailStyles.detailRow}>
              <strong>Destination:</strong> {destinationLabel}
            </Text>
            {appointmentInfo ? (
              <Text style={emailStyles.detailRow}>
                <strong>Appointment:</strong> {appointmentInfo}
              </Text>
            ) : null}
            {customerInfo ? (
              <Text style={emailStyles.detailRow}>
                <strong>Customer:</strong> {customerInfo}
              </Text>
            ) : null}
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button href={adminUrl} style={emailStyles.primaryButton}>
              Complete Trip Log
            </Button>
          </Section>

          <Hr style={emailStyles.hr} />

          <Section style={{ textAlign: "center" }}>
            <Text style={emailStyles.footer}>
              This is an automated notification from {businessName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
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
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
      to: user.email,
      subject: `Reminder: Your appointment is tomorrow - ${appointment.scheduledDate}`,
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
      }),
    );

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
      }),
    );

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
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
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
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
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
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
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
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <notifications@rivercitymd.com>`,
      to: "dustin@rivercitymd.com",
      subject: `Mileage log required - ${tripLog.logDate}`,
      html,
    });
  },
});
