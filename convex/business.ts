import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { api as usersApi } from "./_generated/api";

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
    const invoice = await ctx.runQuery(api.invoices.getById, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) throw new Error("Invoice not found");

    const client = await ctx.runQuery(api.users.getById, {
      userId: invoice.userId,
    });
    if (!client) throw new Error("Client not found");

    const business = await ctx.runQuery(api.business.get);
    if (!business) throw new Error("Business info not set");

    // TODO: Install resend package with: npm install resend
    // const { Resend } = await import("resend");
    // const resend = new Resend(process.env.CONVEX_RESEND_API_KEY);
    // await resend.emails.send({
    //   from: `${business.name} <noreply@convex.dev>`,
    //   to: client.email,
    //   subject: `Invoice ${invoice.invoiceNumber} from ${business.name}`,
    //   html: `Your invoice is ready. Total: $${invoice.total.toFixed(2)}`,
    // });

    console.log(
      `Email would be sent to ${client.email} for invoice ${invoice.invoiceNumber}`,
    );
    return { success: true, message: "Email functionality not yet enabled" };
  },
});
