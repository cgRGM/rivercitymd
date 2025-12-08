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

export const renderWelcomeEmail = action({
  args: {
    userName: v.string(),
    businessName: v.string(),
  },
  handler: async (ctx, args) => {
    return await render(WelcomeEmail(args));
  },
});
