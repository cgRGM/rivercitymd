// IMPORTANT: this is a Convex Node Action
"use node";

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
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { api } from "./_generated/api";

// Initialize Resend component
export const resend: Resend = new Resend(components.resend, {
  testMode: false, // Set to false for production
});

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
    const user = await ctx.runQuery(api.users.getById, {
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
      from: `${business.name} <welcome@${business.name.toLowerCase().replace(/\s+/g, "")}.com>`,
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
    const appointment = await ctx.runQuery(api.appointments.getById, {
      appointmentId: args.appointmentId,
    });
    if (!appointment) return;

    const user = await ctx.runQuery(api.users.getById, {
      userId: appointment.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    // Get services
    const services = await Promise.all(
      appointment.serviceIds.map((id: any) =>
        ctx.runQuery(api.services.getById, { serviceId: id }),
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
      from: `${business.name} <appointments@${business.name.toLowerCase().replace(/\s+/g, "")}.com>`,
      to: user.email,
      subject: `Appointment Confirmed - ${appointment.scheduledDate}`,
      html,
    });
  },
});

// Invoice Email Template Component
interface InvoiceEmailProps {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  dueDate: string;
  total: number;
}

function InvoiceEmail(props: InvoiceEmailProps) {
  const { customerName, businessName, invoiceNumber, dueDate, total } = props;

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
              Invoice from {businessName}
            </Heading>
            <Text
              style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}
            >
              Hi {customerName}, your invoice is ready.
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
            <Text
              style={{ color: "#333", fontSize: "14px", marginBottom: "8px" }}
            >
              <strong>Invoice Number:</strong> {invoiceNumber}
            </Text>
            <Text
              style={{ color: "#333", fontSize: "14px", marginBottom: "8px" }}
            >
              <strong>Due Date:</strong> {dueDate}
            </Text>
            <Text
              style={{ color: "#333", fontSize: "14px", marginBottom: "15px" }}
            >
              <strong>Status:</strong>{" "}
              <span style={{ color: "#28a745", fontWeight: "bold" }}>
                Payment Due
              </span>
            </Text>
            <Text
              style={{ color: "#333", fontSize: "18px", fontWeight: "bold" }}
            >
              Total: ${total.toFixed(2)}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button
              href={`${process.env.CONVEX_SITE_URL}/dashboard/invoices`}
              style={{
                backgroundColor: "#007bff",
                color: "#ffffff",
                padding: "12px 24px",
                textDecoration: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "bold",
                marginRight: "10px",
              }}
            >
              View Invoice
            </Button>
            <Button
              href={`${process.env.CONVEX_SITE_URL}/dashboard/invoices/pay`}
              style={{
                backgroundColor: "#28a745",
                color: "#ffffff",
                padding: "12px 24px",
                textDecoration: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              Pay Now
            </Button>
          </Section>

          <Hr style={{ borderColor: "#eee", margin: "20px 0" }} />

          <Section style={{ textAlign: "center" }}>
            <Text
              style={{ color: "#999", fontSize: "12px", lineHeight: "1.4" }}
            >
              Questions about this invoice? Contact us at billing@
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

// Send Invoice Email
export const sendInvoiceEmail = internalAction({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.runQuery(api.invoices.getById, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) return;

    const user = await ctx.runQuery(api.users.getById, {
      userId: invoice.userId,
    });
    if (!user || !user.email) return;

    const business = await ctx.runQuery(api.business.get);
    if (!business) return;

    const html = await render(
      InvoiceEmail({
        customerName: user.name || "Valued Customer",
        businessName: business.name,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate,
        total: invoice.total,
      }),
    );

    await resend.sendEmail(ctx, {
      from: `${business.name} <billing@${business.name.toLowerCase().replace(/\s+/g, "")}.com>`,
      to: user.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${business.name}`,
      html,
    });
  },
});
