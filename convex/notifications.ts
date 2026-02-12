import { Workpool, vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const ADMIN_NOTIFICATION_EMAIL_TO = "dustin@rivercitymd.com";

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
  },
} as const;

const DEFAULT_USER_NOTIFICATION_PREFERENCES = {
  emailNotifications: true,
  smsNotifications: true,
  marketingEmails: false,
  serviceReminders: true,
  events: {
    appointmentConfirmed: true,
    appointmentCancelled: true,
    appointmentRescheduled: true,
    appointmentStarted: true,
    appointmentCompleted: true,
  },
} as const;

const notificationsWorkpool = new Workpool(components.notificationsWorkpool, {
  maxParallelism: 8,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 4,
    initialBackoffMs: 2000,
    base: 2,
  },
});

const notificationEventValidator = v.union(
  v.literal("new_customer_onboarded"),
  v.literal("appointment_confirmed"),
  v.literal("appointment_cancelled"),
  v.literal("appointment_rescheduled"),
  v.literal("appointment_started"),
  v.literal("appointment_completed"),
  v.literal("review_submitted"),
);

const appointmentLifecycleEventValidator = v.union(
  v.literal("appointment_confirmed"),
  v.literal("appointment_cancelled"),
  v.literal("appointment_rescheduled"),
  v.literal("appointment_started"),
  v.literal("appointment_completed"),
);

const deliveryChannelValidator = v.union(v.literal("email"), v.literal("sms"));
const recipientTypeValidator = v.union(
  v.literal("admin"),
  v.literal("customer"),
);

type NotificationEvent =
  | "new_customer_onboarded"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "appointment_started"
  | "appointment_completed"
  | "review_submitted";

type DeliveryChannel = "email" | "sms";
type RecipientType = "admin" | "customer";

type QueueDispatchArgs = {
  event: NotificationEvent;
  channel: DeliveryChannel;
  recipientType: RecipientType;
  recipient: string;
  userId?: Id<"users">;
  appointmentId?: Id<"appointments">;
  reviewId?: Id<"reviews">;
  transition?: string;
};

function resolveBusinessNotificationSettings(
  settings?: Doc<"businessInfo">["notificationSettings"],
) {
  return {
    emailNotifications:
      settings?.emailNotifications ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.emailNotifications,
    smsNotifications:
      settings?.smsNotifications ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.smsNotifications,
    marketingEmails:
      settings?.marketingEmails ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.marketingEmails,
    events: {
      newCustomerOnboarded:
        settings?.events?.newCustomerOnboarded ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.newCustomerOnboarded,
      appointmentConfirmed:
        settings?.events?.appointmentConfirmed ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentConfirmed,
      appointmentCancelled:
        settings?.events?.appointmentCancelled ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentCancelled,
      appointmentRescheduled:
        settings?.events?.appointmentRescheduled ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentRescheduled,
      appointmentStarted:
        settings?.events?.appointmentStarted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentStarted,
      appointmentCompleted:
        settings?.events?.appointmentCompleted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentCompleted,
      reviewSubmitted:
        settings?.events?.reviewSubmitted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.reviewSubmitted,
    },
  };
}

function resolveUserNotificationPreferences(
  preferences?: Doc<"users">["notificationPreferences"],
) {
  return {
    emailNotifications:
      preferences?.emailNotifications ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.emailNotifications,
    smsNotifications:
      preferences?.smsNotifications ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.smsNotifications,
    marketingEmails:
      preferences?.marketingEmails ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.marketingEmails,
    serviceReminders:
      preferences?.serviceReminders ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.serviceReminders,
    events: {
      appointmentConfirmed:
        preferences?.events?.appointmentConfirmed ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.appointmentConfirmed,
      appointmentCancelled:
        preferences?.events?.appointmentCancelled ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.appointmentCancelled,
      appointmentRescheduled:
        preferences?.events?.appointmentRescheduled ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.appointmentRescheduled,
      appointmentStarted:
        preferences?.events?.appointmentStarted ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.appointmentStarted,
      appointmentCompleted:
        preferences?.events?.appointmentCompleted ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.appointmentCompleted,
    },
  };
}

function isEventEnabledForBusiness(
  settings: ReturnType<typeof resolveBusinessNotificationSettings>,
  event: NotificationEvent,
): boolean {
  if (event === "new_customer_onboarded") {
    return settings.events.newCustomerOnboarded;
  }
  if (event === "appointment_confirmed") {
    return settings.events.appointmentConfirmed;
  }
  if (event === "appointment_cancelled") {
    return settings.events.appointmentCancelled;
  }
  if (event === "appointment_rescheduled") {
    return settings.events.appointmentRescheduled;
  }
  if (event === "appointment_started") {
    return settings.events.appointmentStarted;
  }
  if (event === "appointment_completed") {
    return settings.events.appointmentCompleted;
  }
  return settings.events.reviewSubmitted;
}

function isEventEnabledForCustomer(
  preferences: ReturnType<typeof resolveUserNotificationPreferences>,
  event: NotificationEvent,
): boolean {
  if (event === "appointment_confirmed") {
    return preferences.events.appointmentConfirmed;
  }
  if (event === "appointment_cancelled") {
    return preferences.events.appointmentCancelled;
  }
  if (event === "appointment_rescheduled") {
    return preferences.events.appointmentRescheduled;
  }
  if (event === "appointment_started") {
    return preferences.events.appointmentStarted;
  }
  if (event === "appointment_completed") {
    return preferences.events.appointmentCompleted;
  }
  return false;
}

function isValidRecipient(channel: DeliveryChannel, recipient: string): boolean {
  const value = recipient.trim();
  if (!value) return false;
  if (channel === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function isTestMode(): boolean {
  return process.env.CONVEX_TEST === "true" || process.env.NODE_ENV === "test";
}

function buildDedupeKey(args: QueueDispatchArgs): string {
  return [
    args.event,
    args.channel,
    args.recipientType,
    args.recipient,
    args.userId || "none",
    args.appointmentId || "none",
    args.reviewId || "none",
    args.transition || "none",
  ].join("|");
}

async function queueDispatch(ctx: any, args: QueueDispatchArgs): Promise<void> {
  const dedupeKey = buildDedupeKey(args);
  const existing = await ctx.db
    .query("notificationDispatches")
    .withIndex("by_dedupe_key", (q: any) => q.eq("dedupeKey", dedupeKey))
    .first();
  if (existing) {
    return;
  }

  const now = Date.now();
  if (!isValidRecipient(args.channel, args.recipient)) {
    await ctx.db.insert("notificationDispatches", {
      dedupeKey,
      event: args.event,
      channel: args.channel,
      recipientType: args.recipientType,
      recipient: args.recipient,
      status: "failed",
      userId: args.userId,
      appointmentId: args.appointmentId,
      reviewId: args.reviewId,
      transition: args.transition,
      error: `Invalid or missing ${args.channel} recipient`,
      createdAt: now,
      updatedAt: now,
    });
    if (!isTestMode()) {
      console.error(
        `[notifications] invalid ${args.channel} recipient for ${args.event}: "${args.recipient}"`,
      );
    }
    return;
  }

  const dispatchId = await ctx.db.insert("notificationDispatches", {
    dedupeKey,
    event: args.event,
    channel: args.channel,
    recipientType: args.recipientType,
    recipient: args.recipient,
    status: "queued",
    userId: args.userId,
    appointmentId: args.appointmentId,
    reviewId: args.reviewId,
    transition: args.transition,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const workId = await notificationsWorkpool.enqueueAction(
      ctx,
      internal.notifications.deliverQueuedNotification,
      {
        dispatchId,
        event: args.event,
        channel: args.channel,
        recipientType: args.recipientType,
        recipient: args.recipient,
        userId: args.userId,
        appointmentId: args.appointmentId,
        reviewId: args.reviewId,
        transition: args.transition,
      },
      {
        name: dedupeKey,
        retry: true,
        onComplete: internal.notifications.handleNotificationCompletion,
        context: { dispatchId },
      },
    );

    await ctx.db.patch(dispatchId, {
      workId,
      updatedAt: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isTestMode()) {
      console.error(
        `[notifications] workpool enqueue failed for ${dedupeKey}, falling back to scheduler: ${message}`,
      );
    }

    if (isTestMode()) {
      await ctx.db.patch(dispatchId, {
        status: "failed",
        error: `Workpool unavailable in test mode: ${message}`,
        updatedAt: Date.now(),
      });
      return;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.deliverQueuedNotification,
      {
        dispatchId,
        event: args.event,
        channel: args.channel,
        recipientType: args.recipientType,
        recipient: args.recipient,
        userId: args.userId,
        appointmentId: args.appointmentId,
        reviewId: args.reviewId,
        transition: args.transition,
      },
    );

    await ctx.db.patch(dispatchId, {
      error: `Workpool unavailable, used scheduler fallback: ${message}`,
      updatedAt: Date.now(),
    });
  }
}

async function buildSmsBody(
  ctx: any,
  args: {
    event: NotificationEvent;
    recipientType: RecipientType;
    userId?: Id<"users">;
    appointmentId?: Id<"appointments">;
    reviewId?: Id<"reviews">;
  },
): Promise<string> {
  if (args.event === "new_customer_onboarded") {
    if (!args.userId) throw new Error("Missing userId for onboarding SMS");
    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: args.userId,
    });
    if (!user) throw new Error("User not found for onboarding SMS");
    return `River City MD: New customer onboarded - ${user.name || "Unknown"} (${user.email || "no email"}).`;
  }

  if (args.event === "review_submitted") {
    if (!args.reviewId) throw new Error("Missing reviewId for review SMS");
    const review = await ctx.runQuery(internal.reviews.getByIdInternal, {
      reviewId: args.reviewId,
    });
    if (!review) throw new Error("Review not found");
    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: review.userId,
    });
    return `River City MD: New ${review.rating}-star review from ${user?.name || "a customer"}.`;
  }

  if (!args.appointmentId) {
    throw new Error("Missing appointmentId for appointment SMS");
  }
  const appointment = await ctx.runQuery(internal.appointments.getByIdInternal, {
    appointmentId: args.appointmentId,
  });
  if (!appointment) throw new Error("Appointment not found");

  const user = await ctx.runQuery(internal.users.getByIdInternal, {
    userId: appointment.userId,
  });
  const customerName = user?.name || "customer";

  const statusLabel =
    args.event === "appointment_confirmed"
      ? "confirmed"
      : args.event === "appointment_cancelled"
        ? "cancelled"
        : args.event === "appointment_rescheduled"
          ? "rescheduled"
          : args.event === "appointment_started"
            ? "in progress"
            : "completed";

  if (args.recipientType === "admin") {
    return `River City MD: Appointment ${statusLabel} for ${customerName} on ${appointment.scheduledDate} at ${appointment.scheduledTime}.`;
  }

  return `River City MD: Your appointment is ${statusLabel} for ${appointment.scheduledDate} at ${appointment.scheduledTime}.`;
}

async function deliverEmail(ctx: any, args: QueueDispatchArgs): Promise<void> {
  if (args.event === "new_customer_onboarded") {
    if (!args.userId) throw new Error("Missing userId for onboarding email");
    await ctx.runAction(internal.emails.sendAdminNewCustomerNotification, {
      userId: args.userId,
    });
    return;
  }

  if (args.event === "review_submitted") {
    if (!args.reviewId) throw new Error("Missing reviewId for review email");
    await ctx.runAction(internal.emails.sendAdminReviewSubmittedNotification, {
      reviewId: args.reviewId,
    });
    return;
  }

  if (!args.appointmentId) {
    throw new Error("Missing appointmentId for appointment email");
  }

  if (args.recipientType === "admin") {
    const action =
      args.event === "appointment_confirmed"
        ? "confirmed"
        : args.event === "appointment_cancelled"
          ? "cancelled"
          : args.event === "appointment_rescheduled"
            ? "rescheduled"
            : args.event === "appointment_started"
              ? "started"
              : "completed";

    await ctx.runAction(internal.emails.sendAdminAppointmentNotification, {
      appointmentId: args.appointmentId,
      action,
    });
    return;
  }

  if (args.event === "appointment_confirmed") {
    await ctx.runAction(internal.emails.sendAppointmentConfirmationEmail, {
      appointmentId: args.appointmentId,
    });
    return;
  }

  const status =
    args.event === "appointment_cancelled"
      ? "cancelled"
      : args.event === "appointment_rescheduled"
        ? "rescheduled"
        : args.event === "appointment_started"
          ? "in_progress"
          : "completed";

  await ctx.runAction(internal.emails.sendCustomerAppointmentStatusEmail, {
    appointmentId: args.appointmentId,
    status,
  });
}

async function deliverSms(ctx: any, args: QueueDispatchArgs): Promise<void> {
  const body = await buildSmsBody(ctx, {
    event: args.event,
    recipientType: args.recipientType,
    userId: args.userId,
    appointmentId: args.appointmentId,
    reviewId: args.reviewId,
  });

  await ctx.runAction(internal.sms.sendSms, {
    to: args.recipient,
    body,
  });
}

export const queueNewCustomerOnboarded = internalMutation({
  args: {
    userId: v.id("users"),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const business = await ctx.db.query("businessInfo").first();
    const settings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );
    const adminSmsRecipient = process.env.ADMIN_NOTIFICATION_SMS_TO?.trim();
    const transition = args.transition || "onboarding_complete";

    // Admin email is always attempted for onboarding completion.
    await queueDispatch(ctx, {
      event: "new_customer_onboarded",
      channel: "email",
      recipientType: "admin",
      recipient: ADMIN_NOTIFICATION_EMAIL_TO,
      userId: args.userId,
      transition,
    });

    if (settings.events.newCustomerOnboarded && adminSmsRecipient) {
      await queueDispatch(ctx, {
        event: "new_customer_onboarded",
        channel: "sms",
        recipientType: "admin",
        recipient: adminSmsRecipient,
        userId: args.userId,
        transition,
      });
    }

    return null;
  },
});

export const queueAppointmentLifecycleEvent = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
    event: appointmentLifecycleEventValidator,
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (args.event === "appointment_confirmed") {
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_appointment", (q) =>
          q.eq("appointmentId", args.appointmentId),
        )
        .first();
      if (!invoice?.depositPaid) {
        if (!isTestMode()) {
          console.log(
            `[notifications] skipping appointment_confirmed event for ${args.appointmentId} because deposit is not paid`,
          );
        }
        return null;
      }
    }

    const user = await ctx.db.get(appointment.userId);
    if (!user) {
      throw new Error("Customer not found");
    }

    const business = await ctx.db.query("businessInfo").first();
    const businessSettings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );
    const customerPreferences = resolveUserNotificationPreferences(
      user.notificationPreferences,
    );
    const adminSmsRecipient = process.env.ADMIN_NOTIFICATION_SMS_TO?.trim();
    const transition = args.transition || args.event;

    if (isEventEnabledForBusiness(businessSettings, args.event)) {
      await queueDispatch(ctx, {
        event: args.event,
        channel: "email",
        recipientType: "admin",
        recipient: ADMIN_NOTIFICATION_EMAIL_TO,
        userId: user._id,
        appointmentId: appointment._id,
        transition,
      });
      await queueDispatch(ctx, {
        event: args.event,
        channel: "sms",
        recipientType: "admin",
        recipient: adminSmsRecipient || "",
        userId: user._id,
        appointmentId: appointment._id,
        transition,
      });
    }

    if (isEventEnabledForCustomer(customerPreferences, args.event)) {
      await queueDispatch(ctx, {
        event: args.event,
        channel: "email",
        recipientType: "customer",
        recipient: user.email || "",
        userId: user._id,
        appointmentId: appointment._id,
        transition,
      });
      await queueDispatch(ctx, {
        event: args.event,
        channel: "sms",
        recipientType: "customer",
        recipient: user.phone || "",
        userId: user._id,
        appointmentId: appointment._id,
        transition,
      });
    }

    return null;
  },
});

export const queueReviewSubmitted = internalMutation({
  args: {
    reviewId: v.id("reviews"),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error("Review not found");
    }

    const business = await ctx.db.query("businessInfo").first();
    const settings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );
    if (!settings.events.reviewSubmitted) {
      return null;
    }

    const adminSmsRecipient = process.env.ADMIN_NOTIFICATION_SMS_TO?.trim();
    const transition = args.transition || "review_submitted";

    await queueDispatch(ctx, {
      event: "review_submitted",
      channel: "email",
      recipientType: "admin",
      recipient: ADMIN_NOTIFICATION_EMAIL_TO,
      reviewId: args.reviewId,
      userId: review.userId,
      appointmentId: review.appointmentId,
      transition,
    });

    await queueDispatch(ctx, {
      event: "review_submitted",
      channel: "sms",
      recipientType: "admin",
      recipient: adminSmsRecipient || "",
      reviewId: args.reviewId,
      userId: review.userId,
      appointmentId: review.appointmentId,
      transition,
    });

    return null;
  },
});

export const deliverQueuedNotification = internalAction({
  args: {
    dispatchId: v.id("notificationDispatches"),
    event: notificationEventValidator,
    channel: deliveryChannelValidator,
    recipientType: recipientTypeValidator,
    recipient: v.string(),
    userId: v.optional(v.id("users")),
    appointmentId: v.optional(v.id("appointments")),
    reviewId: v.optional(v.id("reviews")),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(
      `[notifications] delivery attempt event=${args.event} channel=${args.channel} recipientType=${args.recipientType} dispatchId=${args.dispatchId}`,
    );

    if (args.channel === "email") {
      await deliverEmail(ctx, args);
      return null;
    }

    await deliverSms(ctx, args);
    return null;
  },
});

export const handleNotificationCompletion = internalMutation({
  args: vOnCompleteArgs(
    v.object({
      dispatchId: v.id("notificationDispatches"),
    }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const dispatch = await ctx.db.get(args.context.dispatchId);
    if (!dispatch) {
      return null;
    }

    const now = Date.now();
    if (args.result.kind === "success") {
      await ctx.db.patch(dispatch._id, {
        status: "sent",
        error: undefined,
        updatedAt: now,
      });
      return null;
    }

    if (args.result.kind === "canceled") {
      await ctx.db.patch(dispatch._id, {
        status: "canceled",
        error: "Delivery canceled",
        updatedAt: now,
      });
      return null;
    }

    await ctx.db.patch(dispatch._id, {
      status: "failed",
      error: args.result.error,
      updatedAt: now,
    });
    console.error(
      `[notifications] delivery failed dispatchId=${dispatch._id}: ${args.result.error}`,
    );
    return null;
  },
});
