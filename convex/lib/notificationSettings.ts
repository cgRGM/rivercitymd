import { v } from "convex/values";

function parseRecipientList(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function getDefaultAdminEmailRecipients(): string[] {
  const fromEnv = parseRecipientList(
    process.env.ADMIN_NOTIFICATION_EMAIL_TO?.trim(),
  );
  const defaults = ["dustin@rivercitymd.com", "mrgartist333@gmail.com"];
  return Array.from(new Set([...defaults, ...fromEnv]));
}

export function getDefaultAdminSmsRecipients(): string[] {
  return parseRecipientList(process.env.ADMIN_NOTIFICATION_SMS_TO?.trim());
}

export const operationalSmsConsentValidator = v.object({
  optedIn: v.boolean(),
  optedInAt: v.optional(v.number()),
  optedOutAt: v.optional(v.number()),
  source: v.optional(v.string()),
});

export const userNotificationEventsValidator = v.object({
  bookingReceived: v.optional(v.boolean()),
  appointmentConfirmed: v.optional(v.boolean()),
  appointmentReminder: v.optional(v.boolean()),
  appointmentCancelled: v.optional(v.boolean()),
  appointmentRescheduled: v.optional(v.boolean()),
  appointmentStarted: v.optional(v.boolean()),
  appointmentCompleted: v.optional(v.boolean()),
  reviewRequest: v.optional(v.boolean()),
  subscriptionCheckoutLinkSent: v.optional(v.boolean()),
  subscriptionAppointmentScheduled: v.optional(v.boolean()),
});

export const userNotificationPreferencesValidator = v.object({
  emailNotifications: v.optional(v.boolean()),
  smsNotifications: v.optional(v.boolean()),
  marketingEmails: v.optional(v.boolean()),
  serviceReminders: v.optional(v.boolean()),
  operationalSmsConsent: v.optional(operationalSmsConsentValidator),
  events: v.optional(userNotificationEventsValidator),
});

export const businessNotificationEventsValidator = v.object({
  newCustomerOnboarded: v.optional(v.boolean()),
  bookingReceived: v.optional(v.boolean()),
  appointmentConfirmed: v.optional(v.boolean()),
  appointmentCancelled: v.optional(v.boolean()),
  appointmentRescheduled: v.optional(v.boolean()),
  appointmentStarted: v.optional(v.boolean()),
  appointmentCompleted: v.optional(v.boolean()),
  reviewSubmitted: v.optional(v.boolean()),
  mileageLogRequired: v.optional(v.boolean()),
  subscriptionCheckoutLinkSent: v.optional(v.boolean()),
  subscriptionAppointmentScheduled: v.optional(v.boolean()),
  paymentFailed: v.optional(v.boolean()),
});

export const businessNotificationSettingsValidator = v.object({
  emailNotifications: v.optional(v.boolean()),
  smsNotifications: v.optional(v.boolean()),
  marketingEmails: v.optional(v.boolean()),
  adminEmailRecipients: v.optional(v.array(v.string())),
  adminSmsRecipients: v.optional(v.array(v.string())),
  events: v.optional(businessNotificationEventsValidator),
});

export const notificationEventValidator = v.union(
  v.literal("new_customer_onboarded"),
  v.literal("booking_received"),
  v.literal("appointment_confirmed"),
  v.literal("appointment_reminder"),
  v.literal("appointment_cancelled"),
  v.literal("appointment_rescheduled"),
  v.literal("appointment_started"),
  v.literal("appointment_completed"),
  v.literal("review_request"),
  v.literal("review_submitted"),
  v.literal("mileage_log_required"),
  v.literal("subscription_checkout_link_sent"),
  v.literal("subscription_appointment_scheduled"),
  v.literal("payment_failed"),
);

export const DEFAULT_USER_NOTIFICATION_PREFERENCES = {
  emailNotifications: true,
  smsNotifications: false,
  marketingEmails: false,
  serviceReminders: true,
  operationalSmsConsent: {
    optedIn: false,
  },
  events: {
    bookingReceived: true,
    appointmentConfirmed: true,
    appointmentReminder: true,
    appointmentCancelled: true,
    appointmentRescheduled: true,
    appointmentStarted: true,
    appointmentCompleted: true,
    reviewRequest: true,
    subscriptionCheckoutLinkSent: true,
    subscriptionAppointmentScheduled: true,
  },
} as const;

export const DEFAULT_BUSINESS_NOTIFICATION_SETTINGS = {
  emailNotifications: true,
  smsNotifications: true,
  marketingEmails: false,
  adminEmailRecipients: [],
  adminSmsRecipients: [],
  events: {
    newCustomerOnboarded: false,
    bookingReceived: true,
    appointmentConfirmed: true,
    appointmentCancelled: true,
    appointmentRescheduled: true,
    appointmentStarted: true,
    appointmentCompleted: true,
    reviewSubmitted: true,
    mileageLogRequired: true,
    subscriptionCheckoutLinkSent: true,
    subscriptionAppointmentScheduled: true,
    paymentFailed: true,
  },
};

type UserNotificationPreferencesLike = Partial<{
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  serviceReminders: boolean;
  operationalSmsConsent: Partial<{
    optedIn: boolean;
    optedInAt: number;
    optedOutAt: number;
    source: string;
  }>;
  events: Partial<{
    bookingReceived: boolean;
    appointmentConfirmed: boolean;
    appointmentReminder: boolean;
    appointmentCancelled: boolean;
    appointmentRescheduled: boolean;
    appointmentStarted: boolean;
    appointmentCompleted: boolean;
    reviewRequest: boolean;
    subscriptionCheckoutLinkSent: boolean;
    subscriptionAppointmentScheduled: boolean;
  }>;
}>;

type BusinessNotificationSettingsLike = Partial<{
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  adminEmailRecipients: string[];
  adminSmsRecipients: string[];
  events: Partial<{
    newCustomerOnboarded: boolean;
    bookingReceived: boolean;
    appointmentConfirmed: boolean;
    appointmentCancelled: boolean;
    appointmentRescheduled: boolean;
    appointmentStarted: boolean;
    appointmentCompleted: boolean;
    reviewSubmitted: boolean;
    mileageLogRequired: boolean;
    subscriptionCheckoutLinkSent: boolean;
    subscriptionAppointmentScheduled: boolean;
    paymentFailed: boolean;
  }>;
}>;

export function normalizeUserNotificationPreferences(
  preferences?: UserNotificationPreferencesLike,
) {
  const consent = {
    optedIn:
      preferences?.operationalSmsConsent?.optedIn ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.operationalSmsConsent.optedIn,
    optedInAt: preferences?.operationalSmsConsent?.optedInAt,
    optedOutAt: preferences?.operationalSmsConsent?.optedOutAt,
    source: preferences?.operationalSmsConsent?.source,
  };

  return {
    emailNotifications:
      preferences?.emailNotifications ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.emailNotifications,
    smsNotifications:
      consent.optedIn &&
      (preferences?.smsNotifications ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.smsNotifications),
    marketingEmails:
      preferences?.marketingEmails ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.marketingEmails,
    serviceReminders:
      preferences?.serviceReminders ??
      DEFAULT_USER_NOTIFICATION_PREFERENCES.serviceReminders,
    operationalSmsConsent: consent,
    events: {
      bookingReceived:
        preferences?.events?.bookingReceived ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.bookingReceived,
      appointmentConfirmed:
        preferences?.events?.appointmentConfirmed ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.appointmentConfirmed,
      appointmentReminder:
        preferences?.events?.appointmentReminder ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.appointmentReminder,
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
      reviewRequest:
        preferences?.events?.reviewRequest ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events.reviewRequest,
      subscriptionCheckoutLinkSent:
        preferences?.events?.subscriptionCheckoutLinkSent ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events
          .subscriptionCheckoutLinkSent,
      subscriptionAppointmentScheduled:
        preferences?.events?.subscriptionAppointmentScheduled ??
        DEFAULT_USER_NOTIFICATION_PREFERENCES.events
          .subscriptionAppointmentScheduled,
    },
  };
}

export function normalizeBusinessNotificationSettings(
  settings?: BusinessNotificationSettingsLike,
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
    adminEmailRecipients:
      settings.adminEmailRecipients ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.adminEmailRecipients,
    adminSmsRecipients:
      settings.adminSmsRecipients ??
      DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.adminSmsRecipients,
    events: {
      newCustomerOnboarded:
        settings.events?.newCustomerOnboarded ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.newCustomerOnboarded,
      bookingReceived:
        settings.events?.bookingReceived ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.bookingReceived,
      appointmentConfirmed:
        settings.events?.appointmentConfirmed ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentConfirmed,
      appointmentCancelled:
        settings.events?.appointmentCancelled ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentCancelled,
      appointmentRescheduled:
        settings.events?.appointmentRescheduled ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentRescheduled,
      appointmentStarted:
        settings.events?.appointmentStarted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentStarted,
      appointmentCompleted:
        settings.events?.appointmentCompleted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.appointmentCompleted,
      reviewSubmitted:
        settings.events?.reviewSubmitted ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.reviewSubmitted,
      mileageLogRequired:
        settings.events?.mileageLogRequired ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.mileageLogRequired,
      subscriptionCheckoutLinkSent:
        settings.events?.subscriptionCheckoutLinkSent ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events
          .subscriptionCheckoutLinkSent,
      subscriptionAppointmentScheduled:
        settings.events?.subscriptionAppointmentScheduled ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events
          .subscriptionAppointmentScheduled,
      paymentFailed:
        settings.events?.paymentFailed ??
        DEFAULT_BUSINESS_NOTIFICATION_SETTINGS.events.paymentFailed,
    },
  };
}
