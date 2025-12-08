import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";

// Initialize Resend component
export const resend = new Resend(components.resend, {
  testMode: false, // Set to false for production
});

// Invoice Email - Updated version of the existing function
export const sendInvoiceEmail = internalAction({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    // Get invoice details
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Get customer details
    const client = await ctx.db.get(invoice.userId);
    if (!client || !client.email) return;

    // Get business details
    const business = await ctx.db.query("businessInfo").first();
    if (!business) throw new Error("Business info not set");

    // Create HTML email content
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Invoice from ${business.name}</h2>
        <p style="color: #666; line-height: 1.6;">
          Hi ${client.name || "Valued Customer"},
        </p>
        <p style="color: #666; line-height: 1.6;">
          Your invoice ${invoice.invoiceNumber} is ready. Total amount: $${invoice.total.toFixed(2)}
        </p>
        <p style="color: #666; line-height: 1.6;">
          Due date: ${invoice.dueDate}
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CONVEX_SITE_URL}/dashboard/invoices"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Invoice & Pay Now
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          © ${new Date().getFullYear()} ${business.name}. All rights reserved.
        </p>
      </div>
    `;

    await resend.sendEmail(ctx, {
      from: `${business.name} <billing@${business.name.toLowerCase().replace(/\s+/g, "")}.com>`,
      to: client.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${business.name}`,
      html,
    });

    return { success: true, message: "Invoice email sent successfully" };
  },
});
