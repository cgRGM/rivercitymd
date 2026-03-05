import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";

const DEFAULT_BUSINESS_NOTIFICATION_SETTINGS = {
  emailNotifications: true,
  smsNotifications: true,
  marketingEmails: false,
  events: {
    newCustomerOnboarded: true,
    appointmentConfirmed: true,
    appointmentCancelled: true,
    appointmentRescheduled: true,
    appointmentStarted: true,
    appointmentCompleted: true,
    reviewSubmitted: true,
    mileageLogRequired: true,
  },
} as const;

function normalizeBusinessNotificationSettings(
  settings?: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;
    events: {
      newCustomerOnboarded: boolean;
      appointmentConfirmed: boolean;
      appointmentCancelled: boolean;
      appointmentRescheduled: boolean;
      appointmentStarted: boolean;
      appointmentCompleted: boolean;
      reviewSubmitted: boolean;
      mileageLogRequired?: boolean;
    };
  },
) {
  if (!settings) {
    return undefined;
  }

  return {
    emailNotifications:
      settings.emailNotifications ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.emailNotifications,
    smsNotifications:
      settings.smsNotifications ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.smsNotifications,
    marketingEmails:
      settings.marketingEmails ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.marketingEmails,
    events: {
      newCustomerOnboarded:
        settings.events.newCustomerOnboarded ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.newCustomerOnboarded,
      appointmentConfirmed:
        settings.events.appointmentConfirmed ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentConfirmed,
      appointmentCancelled:
        settings.events.appointmentCancelled ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentCancelled,
      appointmentRescheduled:
        settings.events.appointmentRescheduled ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentRescheduled,
      appointmentStarted:
        settings.events.appointmentStarted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentStarted,
      appointmentCompleted:
        settings.events.appointmentCompleted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentCompleted,
      reviewSubmitted:
        settings.events.reviewSubmitted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.reviewSubmitted,
      mileageLogRequired:
        settings.events.mileageLogRequired ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.mileageLogRequired,
    },
  };
}

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requireAdmin(ctx);
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
    return {
      ...business,
      logoUrl,
      notificationSettings: normalizeBusinessNotificationSettings(
        business.notificationSettings,
      ),
    };
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
          mileageLogRequired: v.optional(v.boolean()),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

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
        patchData.notificationSettings = normalizeBusinessNotificationSettings(
          updates.notificationSettings,
        );
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
        notificationSettings: normalizeBusinessNotificationSettings(
          updates.notificationSettings,
        ),
      });
    }
  },
});
