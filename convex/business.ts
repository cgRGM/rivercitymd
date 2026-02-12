import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity } from "./auth";

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
    name: v.optional(v.string()),
    owner: v.optional(v.string()),
    address: v.optional(v.string()),
    cityStateZip: v.optional(v.string()),
    country: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    notificationSettings: v.optional(
      v.object({
        emailNotifications: v.boolean(),
        smsNotifications: v.boolean(),
        marketingEmails: v.boolean(),
        events: v.object({
          newCustomerOnboarded: v.boolean(),
          appointmentConfirmed: v.boolean(),
          appointmentCancelled: v.boolean(),
          appointmentRescheduled: v.boolean(),
          appointmentStarted: v.boolean(),
          appointmentCompleted: v.boolean(),
          reviewSubmitted: v.boolean(),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    if (id) {
      const patchData: Record<string, unknown> = {};
      if (updates.name !== undefined) patchData.name = updates.name;
      if (updates.owner !== undefined) patchData.owner = updates.owner;
      if (updates.address !== undefined) patchData.address = updates.address;
      if (updates.cityStateZip !== undefined)
        patchData.cityStateZip = updates.cityStateZip;
      if (updates.country !== undefined) patchData.country = updates.country;
      if (updates.logoId !== undefined) patchData.logoId = updates.logoId;
      if (updates.notificationSettings !== undefined) {
        patchData.notificationSettings = updates.notificationSettings;
      }

      if (Object.keys(patchData).length === 0) {
        return;
      }

      await ctx.db.patch(id, patchData);
    } else {
      if (
        !updates.name ||
        !updates.owner ||
        !updates.address ||
        !updates.cityStateZip ||
        !updates.country
      ) {
        throw new Error(
          "Missing required fields for business setup: name, owner, address, cityStateZip, country",
        );
      }

      await ctx.db.insert("businessInfo", {
        name: updates.name,
        owner: updates.owner,
        address: updates.address,
        cityStateZip: updates.cityStateZip,
        country: updates.country,
        logoId: updates.logoId,
        notificationSettings: updates.notificationSettings,
      });
    }
  },
});
