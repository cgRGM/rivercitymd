import { Workpool, vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { formatTime12h } from "./lib/time";
import {
  DEFAULT_BUSINESS_NOTIFICATION_SETTINGS,
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  getDefaultAdminEmailRecipients,
  getDefaultAdminSmsRecipients,
  normalizeBusinessNotificationSettings,
  normalizeUserNotificationPreferences,
  notificationEventValidator,
} from "./lib/notificationSettings";

const notificationsWorkpool = new Workpool(components.notificationsWorkpool, {
  maxParallelism: 8,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 4,
    initialBackoffMs: 2000,
    base: 2,
  },
});

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
const deliveryResultValidator = v.object({
  delivered: v.boolean(),
  error: v.optional(v.string()),
});

type NotificationEvent =
  | "new_customer_onboarded"
  | "booking_received"
  | "appointment_confirmed"
  | "appointment_reminder"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "appointment_started"
  | "appointment_completed"
  | "review_request"
  | "review_submitted"
  | "mileage_log_required"
  | "subscription_checkout_link_sent"
  | "subscription_appointment_scheduled"
  | "payment_failed";

type DeliveryChannel = "email" | "sms";
type RecipientType = "admin" | "customer";
type DeliveryResult = {
  delivered: boolean;
  error?: string;
};

type QueueDispatchArgs = {
  event: NotificationEvent;
  channel: DeliveryChannel;
  recipientType: RecipientType;
  recipient: string;
  userId?: Id<"users">;
  appointmentId?: Id<"appointments">;
  invoiceId?: Id<"invoices">;
  reviewId?: Id<"reviews">;
  subscriptionId?: Id<"subscriptions">;
  tripLogId?: Id<"tripLogs">;
  transition?: string;
  dedupeContext?: string;
  scheduleFingerprint?: string;
  checkoutUrl?: string;
  failureReason?: string;
};

function resolveBusinessNotificationSettings(
  settings?: Doc<"businessInfo">["notificationSettings"],
) {
  return (
    normalizeBusinessNotificationSettings(settings) ?? {
      ...DEFAULT_BUSINESS_NOTIFICATION_SETTINGS,
      adminEmailRecipients: getDefaultAdminEmailRecipients(),
      adminSmsRecipients: getDefaultAdminSmsRecipients(),
    }
  );
}

function resolveUserNotificationPreferences(
  preferences?: Doc<"users">["notificationPreferences"],
) {
  return normalizeUserNotificationPreferences(preferences) ?? {
    ...DEFAULT_USER_NOTIFICATION_PREFERENCES,
  };
}

function isEventEnabledForBusiness(
  settings: ReturnType<typeof resolveBusinessNotificationSettings>,
  event: NotificationEvent,
): boolean {
  if (event === "new_customer_onboarded") {
    return settings.events.newCustomerOnboarded;
  }
  if (event === "booking_received") {
    return settings.events.bookingReceived;
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
  if (event === "review_submitted") {
    return settings.events.reviewSubmitted;
  }
  if (event === "mileage_log_required") {
    return settings.events.mileageLogRequired;
  }
  if (event === "subscription_checkout_link_sent") {
    return settings.events.subscriptionCheckoutLinkSent;
  }
  if (event === "subscription_appointment_scheduled") {
    return settings.events.subscriptionAppointmentScheduled;
  }
  if (event === "payment_failed") {
    return settings.events.paymentFailed;
  }
  return false;
}

function isEventEnabledForCustomer(
  preferences: ReturnType<typeof resolveUserNotificationPreferences>,
  event: NotificationEvent,
): boolean {
  if (event === "booking_received") {
    return preferences.events.bookingReceived;
  }
  if (event === "appointment_confirmed") {
    return preferences.events.appointmentConfirmed;
  }
  if (event === "appointment_reminder") {
    return preferences.serviceReminders && preferences.events.appointmentReminder;
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
  if (event === "review_request") {
    return preferences.events.reviewRequest;
  }
  if (event === "subscription_checkout_link_sent") {
    return preferences.events.subscriptionCheckoutLinkSent;
  }
  if (event === "subscription_appointment_scheduled") {
    return preferences.events.subscriptionAppointmentScheduled;
  }
  return false;
}

function isCustomerSmsEvent(event: NotificationEvent): boolean {
  return (
    event === "appointment_confirmed" ||
    event === "appointment_reminder" ||
    event === "appointment_cancelled" ||
    event === "appointment_rescheduled" ||
    event === "appointment_started"
  );
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (phone.trim().startsWith("+")) {
    return phone.trim();
  }
  return `+${digits}`;
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
    args.invoiceId || "none",
    args.reviewId || "none",
    args.subscriptionId || "none",
    args.tripLogId || "none",
    args.dedupeContext || args.transition || "none",
  ].join("|");
}

function adminEmailRecipients(
  settings: ReturnType<typeof resolveBusinessNotificationSettings>,
): string[] {
  return Array.from(
    new Set(
      (settings.adminEmailRecipients.length
        ? settings.adminEmailRecipients
        : getDefaultAdminEmailRecipients()
      ).filter(Boolean),
    ),
  );
}

function adminSmsRecipients(
  settings: ReturnType<typeof resolveBusinessNotificationSettings>,
): string[] {
  return Array.from(
    new Set(
      (settings.adminSmsRecipients.length
        ? settings.adminSmsRecipients
        : getDefaultAdminSmsRecipients()
      ).filter(Boolean),
    ),
  );
}

async function queueDispatch(ctx: any, args: QueueDispatchArgs): Promise<void> {
  if (args.channel === "sms") {
    args.recipient = normalizePhone(args.recipient);
  }

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
      invoiceId: args.invoiceId,
      reviewId: args.reviewId,
      subscriptionId: args.subscriptionId,
      tripLogId: args.tripLogId,
      transition: args.transition,
      dedupeContext: args.dedupeContext,
      scheduleFingerprint: args.scheduleFingerprint,
      checkoutUrl: args.checkoutUrl,
      failureReason: args.failureReason,
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
    invoiceId: args.invoiceId,
    reviewId: args.reviewId,
    subscriptionId: args.subscriptionId,
    tripLogId: args.tripLogId,
    transition: args.transition,
    dedupeContext: args.dedupeContext,
    scheduleFingerprint: args.scheduleFingerprint,
    checkoutUrl: args.checkoutUrl,
    failureReason: args.failureReason,
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
        invoiceId: args.invoiceId,
        reviewId: args.reviewId,
        subscriptionId: args.subscriptionId,
        tripLogId: args.tripLogId,
        transition: args.transition,
        dedupeContext: args.dedupeContext,
        scheduleFingerprint: args.scheduleFingerprint,
        checkoutUrl: args.checkoutUrl,
        failureReason: args.failureReason,
      },
      {
        name: dedupeKey,
        retry: args.channel === "email",
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

    await ctx.scheduler.runAfter(0, internal.notifications.deliverQueuedNotification, {
      dispatchId,
      event: args.event,
      channel: args.channel,
      recipientType: args.recipientType,
      recipient: args.recipient,
      userId: args.userId,
      appointmentId: args.appointmentId,
      invoiceId: args.invoiceId,
      reviewId: args.reviewId,
      subscriptionId: args.subscriptionId,
      tripLogId: args.tripLogId,
      transition: args.transition,
      dedupeContext: args.dedupeContext,
      scheduleFingerprint: args.scheduleFingerprint,
      checkoutUrl: args.checkoutUrl,
      failureReason: args.failureReason,
    });

    await ctx.db.patch(dispatchId, {
      error: `Workpool unavailable, used scheduler fallback: ${message}`,
      updatedAt: Date.now(),
    });
  }
}

async function queueAdminDispatches(
  ctx: any,
  settings: ReturnType<typeof resolveBusinessNotificationSettings>,
  args: Omit<QueueDispatchArgs, "channel" | "recipientType" | "recipient">,
) {
  if (!isEventEnabledForBusiness(settings, args.event)) {
    return;
  }

  if (settings.emailNotifications) {
    for (const recipient of adminEmailRecipients(settings)) {
      await queueDispatch(ctx, {
        ...args,
        channel: "email",
        recipientType: "admin",
        recipient,
      });
    }
  }

  if (settings.smsNotifications) {
    for (const recipient of adminSmsRecipients(settings)) {
      await queueDispatch(ctx, {
        ...args,
        channel: "sms",
        recipientType: "admin",
        recipient,
      });
    }
  }
}

async function queueCustomerDispatches(
  ctx: any,
  preferences: ReturnType<typeof resolveUserNotificationPreferences>,
  args: Omit<QueueDispatchArgs, "channel" | "recipientType" | "recipient"> & {
    email?: string;
    phone?: string;
  },
) {
  if (!isEventEnabledForCustomer(preferences, args.event)) {
    return;
  }

  if (preferences.emailNotifications && args.email) {
    await queueDispatch(ctx, {
      ...args,
      channel: "email",
      recipientType: "customer",
      recipient: args.email,
    });
  }

  if (
    preferences.smsNotifications &&
    preferences.operationalSmsConsent.optedIn &&
    isCustomerSmsEvent(args.event) &&
    args.phone
  ) {
    await queueDispatch(ctx, {
      ...args,
      channel: "sms",
      recipientType: "customer",
      recipient: args.phone,
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
    invoiceId?: Id<"invoices">;
    reviewId?: Id<"reviews">;
    subscriptionId?: Id<"subscriptions">;
    tripLogId?: Id<"tripLogs">;
    failureReason?: string;
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

  if (args.event === "mileage_log_required") {
    if (!args.tripLogId) throw new Error("Missing tripLogId for mileage log SMS");
    const tripLog = await ctx.runQuery(internal.tripLogs.getByIdInternal, {
      tripLogId: args.tripLogId,
    });
    if (!tripLog) throw new Error("Trip log not found");
    const appointment = tripLog.appointmentId
      ? await ctx.runQuery(internal.appointments.getByIdInternal, {
          appointmentId: tripLog.appointmentId,
        })
      : null;
    const appointmentDate = appointment?.scheduledDate || tripLog.logDate || "unknown date";
    return `River City MD: Mileage log required for completed service on ${appointmentDate}. Open Admin > Logs to complete it.`;
  }

  if (args.event === "payment_failed") {
    return `River City MD: Payment failed${args.failureReason ? ` - ${args.failureReason}` : ""}. Review the customer payment status in admin.`;
  }

  if (args.event === "subscription_checkout_link_sent") {
    if (!args.subscriptionId) throw new Error("Missing subscriptionId for subscription SMS");
    const sub = await ctx.runQuery(internal.subscriptions.getByIdInternal, {
      subscriptionId: args.subscriptionId,
    });
    if (!sub) throw new Error("Subscription not found");
    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: sub.userId,
    });
    return `River City MD: Subscription checkout link sent to ${user?.name || user?.email || "customer"} for ${sub.frequency} recurring service.`;
  }

  if (args.event === "subscription_appointment_scheduled") {
    if (!args.appointmentId) {
      throw new Error("Missing appointmentId for subscription appointment SMS");
    }
    const appointment = await ctx.runQuery(internal.appointments.getByIdInternal, {
      appointmentId: args.appointmentId,
    });
    if (!appointment) throw new Error("Appointment not found");
    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: appointment.userId,
    });
    return `River City MD: Recurring service scheduled for ${user?.name || "customer"} on ${appointment.scheduledDate} at ${formatTime12h(appointment.scheduledTime)}.`;
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

  if (args.event === "booking_received") {
    if (args.recipientType === "admin") {
      return `River City MD: New booking received for ${customerName} on ${appointment.scheduledDate} at ${formatTime12h(appointment.scheduledTime)}.`;
    }
    return `River City MD: We received your booking for ${appointment.scheduledDate} at ${formatTime12h(appointment.scheduledTime)}.`;
  }

  if (args.event === "appointment_reminder") {
    return `River City MD: Reminder - your appointment is tomorrow, ${appointment.scheduledDate} at ${formatTime12h(appointment.scheduledTime)}.`;
  }

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
    return `River City MD: Appointment ${statusLabel} for ${customerName} on ${appointment.scheduledDate} at ${formatTime12h(appointment.scheduledTime)}.`;
  }

  return `River City MD: Your appointment is ${statusLabel} for ${appointment.scheduledDate} at ${formatTime12h(appointment.scheduledTime)}.`;
}

async function deliverEmail(ctx: any, args: QueueDispatchArgs): Promise<void> {
  if (args.event === "new_customer_onboarded") {
    if (!args.userId) throw new Error("Missing userId for onboarding email");
    await ctx.runAction(internal.emails.sendAdminNewCustomerNotification, {
      userId: args.userId,
      recipientOverride: args.recipient,
    });
    return;
  }

  if (args.event === "booking_received") {
    if (!args.appointmentId) throw new Error("Missing appointmentId for booking email");
    if (args.recipientType === "admin") {
      await ctx.runAction(internal.emails.sendAdminAppointmentNotification, {
        appointmentId: args.appointmentId,
        action: "created",
        recipientOverride: args.recipient,
      });
    } else {
      await ctx.runAction(internal.emails.sendCustomerBookingReceivedEmail, {
        appointmentId: args.appointmentId,
      });
    }
    return;
  }

  if (args.event === "appointment_reminder") {
    if (!args.appointmentId) throw new Error("Missing appointmentId for reminder email");
    await ctx.runAction(internal.emails.sendAppointmentReminderEmail, {
      appointmentId: args.appointmentId,
    });
    return;
  }

  if (args.event === "review_request") {
    if (!args.appointmentId) throw new Error("Missing appointmentId for review request email");
    await ctx.runAction(internal.emails.sendCustomerReviewRequestEmail, {
      appointmentId: args.appointmentId,
    });
    return;
  }

  if (args.event === "review_submitted") {
    if (!args.reviewId) throw new Error("Missing reviewId for review email");
    await ctx.runAction(internal.emails.sendAdminReviewSubmittedNotification, {
      reviewId: args.reviewId,
      recipientOverride: args.recipient,
    });
    return;
  }

  if (args.event === "mileage_log_required") {
    if (args.recipientType !== "admin") {
      return;
    }
    if (!args.tripLogId) throw new Error("Missing tripLogId for mileage log email");
    await ctx.runAction(internal.emails.sendAdminMileageLogRequiredNotification, {
      tripLogId: args.tripLogId,
      recipientOverride: args.recipient,
    });
    return;
  }

  if (args.event === "subscription_checkout_link_sent") {
    if (!args.subscriptionId || !args.checkoutUrl) {
      throw new Error("Missing subscriptionId or checkoutUrl for subscription checkout email");
    }
    if (args.recipientType === "admin") {
      await ctx.runAction(internal.emails.sendAdminSubscriptionCheckoutLinkNotification, {
        subscriptionId: args.subscriptionId,
        checkoutUrl: args.checkoutUrl,
        recipientOverride: args.recipient,
      });
    } else {
      await ctx.runAction(internal.emails.sendSubscriptionCheckoutLink, {
        subscriptionId: args.subscriptionId,
        checkoutUrl: args.checkoutUrl,
      });
    }
    return;
  }

  if (args.event === "subscription_appointment_scheduled") {
    if (!args.subscriptionId || !args.appointmentId) {
      throw new Error("Missing subscriptionId or appointmentId for subscription appointment email");
    }
    if (args.recipientType === "admin") {
      await ctx.runAction(internal.emails.sendAdminAppointmentNotification, {
        appointmentId: args.appointmentId,
        action: "created",
        recipientOverride: args.recipient,
      });
    } else {
      await ctx.runAction(internal.emails.sendSubscriptionAppointmentCreated, {
        subscriptionId: args.subscriptionId,
        appointmentId: args.appointmentId,
      });
    }
    return;
  }

  if (args.event === "payment_failed") {
    if (args.recipientType !== "admin") return;
    await ctx.runAction(internal.emails.sendAdminPaymentFailedNotification, {
      appointmentId: args.appointmentId,
      invoiceId: args.invoiceId,
      subscriptionId: args.subscriptionId,
      failureReason: args.failureReason,
      recipientOverride: args.recipient,
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
      recipientOverride: args.recipient,
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
    invoiceId: args.invoiceId,
    reviewId: args.reviewId,
    subscriptionId: args.subscriptionId,
    tripLogId: args.tripLogId,
    failureReason: args.failureReason,
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

    await queueAdminDispatches(ctx, settings, {
      event: "new_customer_onboarded",
      userId: args.userId,
      transition: args.transition || "onboarding_complete",
    });

    return null;
  },
});

export const queueBookingReceived = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
    invoiceId: v.id("invoices"),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    const business = await ctx.db.query("businessInfo").first();
    const businessSettings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );
    const user = await ctx.db.get(appointment.userId);
    const transition = args.transition || "checkout_succeeded";
    const dedupeContext = `invoice:${args.invoiceId}`;
    const scheduleFingerprint = `${appointment.scheduledDate}|${appointment.scheduledTime}`;

    await queueAdminDispatches(ctx, businessSettings, {
      event: "booking_received",
      userId: user?._id,
      appointmentId: appointment._id,
      invoiceId: args.invoiceId,
      transition,
      dedupeContext,
      scheduleFingerprint,
    });

    if (user) {
      const customerPreferences = resolveUserNotificationPreferences(
        user.notificationPreferences,
      );
      await queueCustomerDispatches(ctx, customerPreferences, {
        event: "booking_received",
        userId: user._id,
        appointmentId: appointment._id,
        invoiceId: args.invoiceId,
        transition,
        dedupeContext,
        scheduleFingerprint,
        email: user.email || undefined,
        phone: user.phone || undefined,
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
    dedupeContext: v.optional(v.string()),
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
    const business = await ctx.db.query("businessInfo").first();
    const businessSettings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );
    const transition = args.transition || args.event;
    const scheduleFingerprint = `${appointment.scheduledDate}|${appointment.scheduledTime}`;
    const dedupeContext =
      args.dedupeContext ||
      (args.event === "appointment_rescheduled"
        ? scheduleFingerprint
        : undefined);

    await queueAdminDispatches(ctx, businessSettings, {
      event: args.event,
      userId: user?._id,
      appointmentId: appointment._id,
      transition,
      dedupeContext,
      scheduleFingerprint,
    });

    if (user) {
      const customerPreferences = resolveUserNotificationPreferences(
        user.notificationPreferences,
      );
      await queueCustomerDispatches(ctx, customerPreferences, {
        event: args.event,
        userId: user._id,
        appointmentId: appointment._id,
        transition,
        dedupeContext,
        scheduleFingerprint,
        email: user.email || undefined,
        phone: user.phone || undefined,
      });
    } else {
      console.warn(
        `[notifications] Customer not found for appointment ${args.appointmentId}. Skipping customer notifications.`,
      );
    }

    return null;
  },
});

export const queueAppointmentReminder = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
    scheduleFingerprint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return null;
    if (
      appointment.status === "cancelled" ||
      appointment.status === "rescheduled"
    ) {
      return null;
    }

    const user = await ctx.db.get(appointment.userId);
    if (!user) return null;

    const preferences = resolveUserNotificationPreferences(
      user.notificationPreferences,
    );
    await queueCustomerDispatches(ctx, preferences, {
      event: "appointment_reminder",
      userId: user._id,
      appointmentId: appointment._id,
      transition: "24h_reminder",
      dedupeContext: args.scheduleFingerprint,
      scheduleFingerprint: args.scheduleFingerprint,
      email: user.email || undefined,
      phone: user.phone || undefined,
    });

    return null;
  },
});

export const queueReviewRequest = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");
    const user = await ctx.db.get(appointment.userId);
    if (!user) return null;

    const preferences = resolveUserNotificationPreferences(
      user.notificationPreferences,
    );
    await queueCustomerDispatches(ctx, preferences, {
      event: "review_request",
      userId: user._id,
      appointmentId: appointment._id,
      transition: args.transition || "completed->review_request",
      dedupeContext: `review_request:${appointment._id}`,
      email: user.email || undefined,
      phone: user.phone || undefined,
    });

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

    await queueAdminDispatches(ctx, settings, {
      event: "review_submitted",
      reviewId: args.reviewId,
      userId: review.userId,
      appointmentId: review.appointmentId,
      transition: args.transition || "review_submitted",
    });

    return null;
  },
});

export const queueMileageLogRequired = internalMutation({
  args: {
    tripLogId: v.id("tripLogs"),
    appointmentId: v.optional(v.id("appointments")),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tripLog = await ctx.db.get(args.tripLogId);
    if (!tripLog) {
      throw new Error("Trip log not found");
    }

    const business = await ctx.db.query("businessInfo").first();
    const settings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );

    await queueAdminDispatches(ctx, settings, {
      event: "mileage_log_required",
      userId: tripLog.userId,
      appointmentId: args.appointmentId ?? tripLog.appointmentId,
      tripLogId: tripLog._id,
      transition: args.transition || "mileage_log_required",
    });

    return null;
  },
});

export const queueSubscriptionCheckoutLinkSent = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    checkoutUrl: v.string(),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub) throw new Error("Subscription not found");
    const user = await ctx.db.get(sub.userId);
    const business = await ctx.db.query("businessInfo").first();
    const settings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );
    const transition = args.transition || "subscription_checkout_link_sent";
    const dedupeContext = `checkout:${sub._id}:${args.checkoutUrl}`;

    await queueAdminDispatches(ctx, settings, {
      event: "subscription_checkout_link_sent",
      userId: user?._id,
      subscriptionId: sub._id,
      transition,
      dedupeContext,
      checkoutUrl: args.checkoutUrl,
    });

    if (user) {
      const preferences = resolveUserNotificationPreferences(
        user.notificationPreferences,
      );
      await queueCustomerDispatches(ctx, preferences, {
        event: "subscription_checkout_link_sent",
        userId: user._id,
        subscriptionId: sub._id,
        transition,
        dedupeContext,
        checkoutUrl: args.checkoutUrl,
        email: user.email || undefined,
        phone: user.phone || undefined,
      });
    }

    return null;
  },
});

export const queueSubscriptionAppointmentScheduled = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    appointmentId: v.id("appointments"),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");
    const user = await ctx.db.get(appointment.userId);
    const business = await ctx.db.query("businessInfo").first();
    const settings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );
    const transition = args.transition || "subscription_appointment_scheduled";
    const dedupeContext = `subscription:${args.subscriptionId}:${args.appointmentId}`;
    const scheduleFingerprint = `${appointment.scheduledDate}|${appointment.scheduledTime}`;

    await queueAdminDispatches(ctx, settings, {
      event: "subscription_appointment_scheduled",
      userId: user?._id,
      subscriptionId: args.subscriptionId,
      appointmentId: args.appointmentId,
      transition,
      dedupeContext,
      scheduleFingerprint,
    });

    if (user) {
      const preferences = resolveUserNotificationPreferences(
        user.notificationPreferences,
      );
      await queueCustomerDispatches(ctx, preferences, {
        event: "subscription_appointment_scheduled",
        userId: user._id,
        subscriptionId: args.subscriptionId,
        appointmentId: args.appointmentId,
        transition,
        dedupeContext,
        scheduleFingerprint,
        email: user.email || undefined,
        phone: user.phone || undefined,
      });
    }

    return null;
  },
});

export const queuePaymentFailed = internalMutation({
  args: {
    appointmentId: v.optional(v.id("appointments")),
    invoiceId: v.optional(v.id("invoices")),
    subscriptionId: v.optional(v.id("subscriptions")),
    userId: v.optional(v.id("users")),
    failureReason: v.optional(v.string()),
    transition: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const business = await ctx.db.query("businessInfo").first();
    const settings = resolveBusinessNotificationSettings(
      business?.notificationSettings,
    );

    await queueAdminDispatches(ctx, settings, {
      event: "payment_failed",
      userId: args.userId,
      appointmentId: args.appointmentId,
      invoiceId: args.invoiceId,
      subscriptionId: args.subscriptionId,
      failureReason: args.failureReason,
      transition: args.transition || "payment_failed",
      dedupeContext:
        args.subscriptionId ||
        args.invoiceId ||
        args.appointmentId ||
        args.failureReason ||
        "payment_failed",
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
    invoiceId: v.optional(v.id("invoices")),
    reviewId: v.optional(v.id("reviews")),
    subscriptionId: v.optional(v.id("subscriptions")),
    tripLogId: v.optional(v.id("tripLogs")),
    transition: v.optional(v.string()),
    dedupeContext: v.optional(v.string()),
    scheduleFingerprint: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  returns: deliveryResultValidator,
  handler: async (ctx, args) => {
    console.log(
      `[notifications] delivery attempt event=${args.event} channel=${args.channel} recipientType=${args.recipientType} dispatchId=${args.dispatchId}`,
    );

    let result: DeliveryResult;

    if (args.channel === "email") {
      await deliverEmail(ctx, args);
      result = { delivered: true };
    } else {
      try {
        await deliverSms(ctx, args);
        result = { delivered: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[notifications] sms delivery failed dispatchId=${args.dispatchId}: ${message}`,
        );
        result = { delivered: false, error: message };
      }
    }

    await ctx.runMutation(internal.notifications.markDispatchDelivered, {
      dispatchId: args.dispatchId,
      delivered: result.delivered,
      error: result.error,
    });

    return result;
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
      const returnValue = (args.result.returnValue || null) as DeliveryResult | null;
      if (returnValue && !returnValue.delivered) {
        const error =
          returnValue.error || "Delivery reported failure without an error message";
        await ctx.db.patch(dispatch._id, {
          status: "failed",
          error,
          updatedAt: now,
        });
        console.error(
          `[notifications] delivery failed dispatchId=${dispatch._id}: ${error}`,
        );
        return null;
      }

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

export const markDispatchDelivered = internalMutation({
  args: {
    dispatchId: v.id("notificationDispatches"),
    delivered: v.boolean(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dispatch = await ctx.db.get(args.dispatchId);
    if (!dispatch) return null;
    if (dispatch.status !== "queued") return null;

    const now = Date.now();
    if (args.delivered) {
      await ctx.db.patch(dispatch._id, {
        status: "sent",
        error: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(dispatch._id, {
        status: "failed",
        error: args.error || "Delivery failed",
        updatedAt: now,
      });
    }
    return null;
  },
});
