// IMPORTANT: this is a Convex Node Action
"use node";

import { action } from "../_generated/server";
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

            <Text
              style={{ color: "#666", fontSize: "14px", lineHeight: "1.6" }}
            >
              <strong>What to expect:</strong>
            </Text>
            <ul
              style={{
                color: "#666",
                fontSize: "14px",
                lineHeight: "1.6",
                paddingLeft: "20px",
                marginTop: "10px",
              }}
            >
              <li>Professional detailer will call 15 minutes before arrival</li>
              <li>All work performed with premium products and equipment</li>
              <li>Payment processed upon completion</li>
              <li>You'll receive a detailed invoice and receipt</li>
            </ul>
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
            <Button
              href={`tel:+15551234567`}
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
              Call Us
            </Button>
          </Section>

          <Hr style={{ borderColor: "#eee", margin: "20px 0" }} />

          <Section style={{ textAlign: "center" }}>
            <Text
              style={{ color: "#999", fontSize: "12px", lineHeight: "1.4" }}
            >
              Need to reschedule? Contact us at least 24 hours in advance.
            </Text>
            <Text
              style={{ color: "#999", fontSize: "12px", marginTop: "10px" }}
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

export const renderAppointmentConfirmationEmail = action({
  args: {
    customerName: v.string(),
    businessName: v.string(),
    appointmentDate: v.string(),
    appointmentTime: v.string(),
    services: v.array(v.string()),
    location: v.string(),
    totalPrice: v.number(),
    appointmentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await render(AppointmentConfirmationEmail(args));
  },
});
