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

interface InvoiceItem {
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceEmailProps {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  appointmentId: string;
}

function InvoiceEmail(props: InvoiceEmailProps) {
  const {
    customerName,
    businessName,
    invoiceNumber,
    dueDate,
    items,
    subtotal,
    tax,
    total,
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
          </Section>

          <Section style={{ marginBottom: "30px" }}>
            <Heading
              style={{ color: "#333", fontSize: "18px", marginBottom: "15px" }}
            >
              Invoice Details
            </Heading>

            {/* Invoice Items Table */}
            <div
              style={{
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  display: "flex",
                  padding: "10px",
                  borderBottom: "1px solid #dee2e6",
                }}
              >
                <div
                  style={{ flex: "2", fontSize: "14px", fontWeight: "bold" }}
                >
                  Service
                </div>
                <div
                  style={{
                    flex: "1",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Qty
                </div>
                <div
                  style={{
                    flex: "1",
                    textAlign: "right",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Unit Price
                </div>
                <div
                  style={{
                    flex: "1",
                    textAlign: "right",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Total
                </div>
              </div>

              {/* Items */}
              {items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    padding: "10px",
                    borderBottom:
                      index < items.length - 1 ? "1px solid #dee2e6" : "none",
                  }}
                >
                  <div style={{ flex: "2", fontSize: "14px" }}>
                    {item.serviceName}
                  </div>
                  <div
                    style={{ flex: "1", textAlign: "center", fontSize: "14px" }}
                  >
                    {item.quantity}
                  </div>
                  <div
                    style={{ flex: "1", textAlign: "right", fontSize: "14px" }}
                  >
                    ${item.unitPrice.toFixed(2)}
                  </div>
                  <div
                    style={{ flex: "1", textAlign: "right", fontSize: "14px" }}
                  >
                    ${item.totalPrice.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <Section style={{ marginTop: "20px", textAlign: "right" }}>
              <Text
                style={{ color: "#666", fontSize: "14px", marginBottom: "5px" }}
              >
                Subtotal: ${subtotal.toFixed(2)}
              </Text>
              <Text
                style={{ color: "#666", fontSize: "14px", marginBottom: "5px" }}
              >
                Tax: ${tax.toFixed(2)}
              </Text>
              <Text
                style={{ color: "#333", fontSize: "18px", fontWeight: "bold" }}
              >
                Total: ${total.toFixed(2)}
              </Text>
            </Section>
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
              Your payment is due by {dueDate}. You can pay online through your
              dashboard or contact us for payment arrangements.
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
              href={`${process.env.CONVEX_SITE_URL}/dashboard/invoices/${appointmentId}/pay`}
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

export const renderInvoiceEmail = action({
  args: {
    customerName: v.string(),
    businessName: v.string(),
    invoiceNumber: v.string(),
    dueDate: v.string(),
    items: v.array(
      v.object({
        serviceName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        totalPrice: v.number(),
      }),
    ),
    subtotal: v.number(),
    tax: v.number(),
    total: v.number(),
    appointmentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await render(InvoiceEmail(args));
  },
});
