import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const get = query({
  handler: async (ctx) => {
    const business = await ctx.db.query("businessInfo").first();
    if (!business) {
      return null;
    }
    const logoUrl = business.logoId
      ? await ctx.storage.getUrl(business.logoId)
      : null;
    return { ...business, logoUrl };
  },
});

export const update = mutation({
  args: {
    id: v.optional(v.id("businessInfo")),
    name: v.string(),
    owner: v.string(),
    address: v.string(),
    cityStateZip: v.string(),
    country: v.string(),
    logoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    if (id) {
      await ctx.db.patch(id, updates);
    } else {
      await ctx.db.insert("businessInfo", updates);
    }
  },
});

export const sendInvoiceEmail = action({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    // Get invoice details
    const invoice = await ctx.runQuery(api.invoices.getById, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) throw new Error("Invoice not found");

    // Get customer details
    const client = await ctx.runQuery(api.users.getById, {
      userId: invoice.userId,
    });
    if (!client || !client.email) return;

    // Get business details
    const business = await ctx.runQuery(api.business.get);
    if (!business) throw new Error("Business info not set");

    // Initialize Resend
    const resend = new Resend(components.resend, {
      testMode: false,
    });

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
      from: `${business.name} <billing@notifications.rivercitymd.com>`,
      to: client.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${business.name}`,
      html,
    });

    return { success: true, message: "Invoice email sent successfully" };
  },
});
