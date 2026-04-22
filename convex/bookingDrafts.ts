import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getNormalizedIdentityEmail,
  getUserIdFromIdentity,
  requireAdmin,
} from "./auth";
import { BOOKING_BLOCK_MINUTES, normalizeDateKey } from "./lib/booking";
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  normalizeUserNotificationPreferences,
} from "./lib/notificationSettings";
import {
  getEffectivePetFeePrice,
  getEffectiveServicePrice,
  type VehicleSize,
} from "./lib/pricing";

const HOLD_DURATION_MS = 15 * 60 * 1000;
const ABANDONED_EMAIL_DELAY_MS = 60 * 60 * 1000;

const addressValidator = v.object({
  street: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  notes: v.optional(v.string()),
});

const draftVehicleValidator = v.object({
  year: v.number(),
  make: v.string(),
  model: v.string(),
  size: v.optional(
    v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
  ),
  color: v.optional(v.string()),
  licensePlate: v.optional(v.string()),
  hasPet: v.optional(v.boolean()),
});

const bookingPaymentOptionValidator = v.union(
  v.literal("deposit"),
  v.literal("full"),
  v.literal("in_person"),
);

type ConvertedDraftResult = {
  appointmentId: Id<"appointments">;
  invoiceId: Id<"invoices">;
  userId: Id<"users">;
  paymentOption: "deposit" | "full" | "in_person";
  isFullPayment: boolean;
  total: number;
};

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function createResumeToken() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto
    .randomUUID()
    .replaceAll("-", "")}`;
}

function getVehicleSizeForDraft(args: {
  existingVehicles: Array<Doc<"vehicles">>;
  draftVehicles: Array<{
    size?: VehicleSize;
  }>;
}): VehicleSize {
  const sizes = [
    ...args.existingVehicles.map((vehicle) => vehicle.size ?? "medium"),
    ...args.draftVehicles.map((vehicle) => vehicle.size ?? "medium"),
  ];

  if (sizes.includes("large")) {
    return "large";
  }
  if (sizes.includes("medium")) {
    return "medium";
  }
  return "small";
}

function formatVehicleSizeLabel(size: VehicleSize) {
  if (size === "small") return "Small";
  if (size === "large") return "Large";
  return "Medium";
}

function assertBookableServices(
  services: Doc<"services">[],
  requestedServiceIds: Id<"services">[],
  vehicleSize: VehicleSize,
) {
  if (services.length !== requestedServiceIds.length) {
    throw new ConvexError({
      code: "SERVICE_NOT_BOOKABLE",
      message: "One or more selected services are unavailable.",
    });
  }

  for (const service of services) {
    if (!service.isActive) {
      throw new ConvexError({
        code: "SERVICE_NOT_BOOKABLE",
        message: `${service.name} is currently unavailable.`,
      });
    }

    const price = getEffectiveServicePrice(service, vehicleSize);
    if (price <= 0) {
      throw new ConvexError({
        code: "SERVICE_NOT_BOOKABLE",
        message: `${service.name} is not available for the selected vehicle size.`,
      });
    }
  }
}

function buildBookingNotificationPreferences(smsOptIn: boolean, now: number) {
  return normalizeUserNotificationPreferences({
    ...DEFAULT_USER_NOTIFICATION_PREFERENCES,
    smsNotifications: smsOptIn,
    operationalSmsConsent: {
      optedIn: smsOptIn,
      optedInAt: smsOptIn ? now : undefined,
      optedOutAt: smsOptIn ? undefined : now,
      source: "booking_draft",
    },
  });
}

function buildUpdatedNotificationPreferences(
  currentPreferences: Doc<"users">["notificationPreferences"],
  smsOptIn: boolean,
  now: number,
) {
  const current = normalizeUserNotificationPreferences(currentPreferences);
  return normalizeUserNotificationPreferences({
    ...current,
    smsNotifications: smsOptIn,
    operationalSmsConsent: {
      ...current.operationalSmsConsent,
      optedIn: smsOptIn,
      optedInAt: smsOptIn
        ? current.operationalSmsConsent.optedInAt ?? now
        : current.operationalSmsConsent.optedInAt,
      optedOutAt: smsOptIn ? undefined : now,
      source: smsOptIn
        ? current.operationalSmsConsent.source ?? "booking_draft"
        : current.operationalSmsConsent.source,
    },
  });
}

async function cancelScheduledDraftJobs(
  ctx: {
    scheduler: {
      cancel: (scheduledId: Id<"_scheduled_functions">) => Promise<void>;
    };
  },
  draft: {
    holdExpiryScheduledId?: Id<"_scheduled_functions">;
    abandonedEmailScheduledId?: Id<"_scheduled_functions">;
  },
) {
  if (draft.holdExpiryScheduledId) {
    await ctx.scheduler.cancel(draft.holdExpiryScheduledId);
  }
  if (draft.abandonedEmailScheduledId) {
    await ctx.scheduler.cancel(draft.abandonedEmailScheduledId);
  }
}

async function getDraftByToken(
  ctx: { db: any },
  resumeToken: string,
): Promise<Doc<"bookingDrafts"> | null> {
  return await ctx.db
    .query("bookingDrafts")
    .withIndex("by_resume_token", (q: any) => q.eq("resumeToken", resumeToken))
    .first();
}

async function getServicesForDraft(
  ctx: { db: any },
  serviceIds: Id<"services">[],
) {
  const services = await Promise.all(serviceIds.map((serviceId) => ctx.db.get(serviceId)));
  return services.filter(
    (service): service is Doc<"services"> => service !== null,
  );
}

async function buildDraftPricing(args: {
  ctx: any;
  serviceIds: Id<"services">[];
  vehicleCount: number;
  vehicleSize: VehicleSize;
  existingVehicles: Array<Doc<"vehicles">>;
  draftVehicles: Array<{
    size?: VehicleSize;
    hasPet?: boolean;
  }>;
  petFeeExistingVehicleIds: Id<"vehicles">[];
}) {
  const services = await getServicesForDraft(args.ctx, args.serviceIds);
  assertBookableServices(services, args.serviceIds, args.vehicleSize);

  const items = services.map((service) => {
    const unitPrice = getEffectiveServicePrice(service, args.vehicleSize);

    return {
      itemType: "service" as const,
      serviceId: service._id,
      serviceName: service.name,
      quantity: args.vehicleCount,
      unitPrice,
      totalPrice: unitPrice * args.vehicleCount,
    };
  });

  const petFeeSettings = await args.ctx.runQuery(
    internal.petFeeSettings.getInternal,
    {},
  );
  const petFeeVehicleIdSet = new Set(args.petFeeExistingVehicleIds);
  const petFeeSizes = [
    ...args.existingVehicles
      .filter((vehicle) => petFeeVehicleIdSet.has(vehicle._id))
      .map((vehicle) => vehicle.size ?? "medium"),
    ...args.draftVehicles
      .filter((vehicle) => vehicle.hasPet)
      .map((vehicle) => vehicle.size ?? "medium"),
  ];
  const petFeeItems = (["small", "medium", "large"] as VehicleSize[])
    .map((size) => {
      const quantity = petFeeSizes.filter((petFeeSize) => petFeeSize === size).length;
      const unitPrice = getEffectivePetFeePrice(petFeeSettings, size);
      return {
        itemType: "pet_fee" as const,
        serviceName: `Pet fee - ${formatVehicleSizeLabel(size)} vehicle`,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
    })
    .filter((item) => item.quantity > 0 && item.totalPrice > 0);

  const priceItems = [...items, ...petFeeItems];

  const totalPrice = priceItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const duration = services.reduce((sum, service) => sum + (service.duration || 0), 0);
  const depositSettings = await args.ctx.runQuery(
    internal.depositSettings.getInternal,
    {},
  );
  const depositPerVehicle = depositSettings?.amountPerVehicle ?? 50;
  const depositAmount = Math.min(depositPerVehicle * args.vehicleCount, totalPrice);
  const remainingBalance = Math.max(0, totalPrice - depositAmount);

  return {
    services,
    items: priceItems,
    totalPrice,
    duration,
    depositAmount,
    remainingBalance,
  };
}

function buildClaimRedirectPath(onboardingComplete: boolean) {
  return onboardingComplete
    ? "/dashboard/appointments?payment=success"
    : "/onboarding?payment=success";
}

export const createOrUpdate = mutation({
  args: {
    resumeToken: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    smsOptIn: v.optional(v.boolean()),
    address: addressValidator,
    existingVehicleIds: v.optional(v.array(v.id("vehicles"))),
    vehicles: v.optional(v.array(draftVehicleValidator)),
    petFeeExistingVehicleIds: v.optional(v.array(v.id("vehicles"))),
    serviceIds: v.array(v.id("services")),
    scheduledDate: v.string(),
    scheduledTime: v.string(),
    paymentOption: v.optional(bookingPaymentOptionValidator),
  },
  returns: v.object({
    draftId: v.id("bookingDrafts"),
    resumeToken: v.string(),
  }),
  handler: async (ctx, args) => {
    const authUserId = await getUserIdFromIdentity(ctx);
    const now = Date.now();
    const scheduledDate = normalizeDateKey(args.scheduledDate);
    const existingVehicleIds = args.existingVehicleIds ?? [];
    const draftVehicles = args.vehicles ?? [];
    const petFeeExistingVehicleIds = args.petFeeExistingVehicleIds ?? [];

    if (existingVehicleIds.length === 0 && draftVehicles.length === 0) {
      throw new ConvexError({
        code: "SERVICE_NOT_BOOKABLE",
        message: "Please add at least one vehicle before booking.",
      });
    }

    const existingVehicles = await Promise.all(
      existingVehicleIds.map((vehicleId) => ctx.db.get(vehicleId)),
    );
    const validExistingVehicles = existingVehicles.filter(
      (vehicle): vehicle is Doc<"vehicles"> => vehicle !== null,
    );
    if (validExistingVehicles.length !== existingVehicleIds.length) {
      throw new ConvexError({
        code: "SERVICE_NOT_BOOKABLE",
        message: "One or more selected vehicles are unavailable.",
      });
    }

    if (
      authUserId &&
      validExistingVehicles.some((vehicle) => vehicle.userId !== authUserId)
    ) {
      throw new ConvexError({
        code: "SERVICE_NOT_BOOKABLE",
        message: "You can only book using your own saved vehicles.",
      });
    }

    if (!authUserId && existingVehicleIds.length > 0) {
      throw new ConvexError({
        code: "SERVICE_NOT_BOOKABLE",
        message: "Please sign in to reuse a saved vehicle.",
      });
    }

    const existingVehicleIdSet = new Set(existingVehicleIds);
    if (petFeeExistingVehicleIds.some((vehicleId) => !existingVehicleIdSet.has(vehicleId))) {
      throw new ConvexError({
        code: "SERVICE_NOT_BOOKABLE",
        message: "Pet fee vehicles must be included in this booking.",
      });
    }

    const vehicleCount = existingVehicleIds.length + draftVehicles.length;
    const vehicleSize = getVehicleSizeForDraft({
      existingVehicles: validExistingVehicles,
      draftVehicles,
    });

    let existingDraft: Doc<"bookingDrafts"> | null = null;
    if (args.resumeToken) {
      existingDraft = await getDraftByToken(ctx, args.resumeToken);
      if (existingDraft?.status === "converted") {
        throw new ConvexError({
          code: "TIME_SLOT_UNAVAILABLE",
          message: "This booking has already been completed.",
        });
      }
    }

    const slotAvailability = await ctx.runQuery(api.availability.checkAvailability, {
      date: scheduledDate,
      startTime: args.scheduledTime,
      duration: BOOKING_BLOCK_MINUTES,
      ignoreBookingDraftId: existingDraft?._id,
    });
    if (!slotAvailability.available) {
      throw new ConvexError({
        code: "TIME_SLOT_UNAVAILABLE",
        message: slotAvailability.reason || "Selected time is no longer available.",
      });
    }

    const pricing = await buildDraftPricing({
      ctx,
      serviceIds: args.serviceIds,
      vehicleCount,
      vehicleSize,
      existingVehicles: validExistingVehicles,
      draftVehicles,
      petFeeExistingVehicleIds,
    });

    if (existingDraft) {
      await cancelScheduledDraftJobs(ctx, existingDraft);
      await ctx.db.patch(existingDraft._id, {
        sourceUserId: authUserId ?? undefined,
        customerName: args.name,
        customerEmail: normalizeEmail(args.email),
        customerPhone: args.phone,
        smsOptIn: args.smsOptIn ?? false,
        address: args.address,
        existingVehicleIds,
        draftVehicles,
        petFeeExistingVehicleIds,
        serviceIds: args.serviceIds,
        scheduledDate,
        scheduledTime: args.scheduledTime,
        duration: pricing.duration,
        vehicleCount,
        vehicleSize,
        totalPrice: pricing.totalPrice,
        depositAmount:
          (args.paymentOption ?? "deposit") === "full"
            ? pricing.totalPrice
            : pricing.depositAmount,
        remainingBalance:
          (args.paymentOption ?? "deposit") === "full"
            ? 0
            : pricing.remainingBalance,
        paymentOption: args.paymentOption ?? "deposit",
        priceSnapshot: pricing.items,
        status: "draft",
        stripeCheckoutSessionId: undefined,
        stripeCheckoutUrl: undefined,
        holdExpiresAt: undefined,
        holdExpiryScheduledId: undefined,
        abandonedEmailScheduledId: undefined,
        cancelledAt: undefined,
        expiredAt: undefined,
        completedAt: undefined,
        convertedAt: undefined,
        lastActivityAt: now,
      });

      return {
        draftId: existingDraft._id,
        resumeToken: existingDraft.resumeToken,
      };
    }

    const resumeToken = args.resumeToken ?? createResumeToken();
    const draftId = await ctx.db.insert("bookingDrafts", {
      sourceUserId: authUserId ?? undefined,
      customerName: args.name,
      customerEmail: normalizeEmail(args.email),
      customerPhone: args.phone,
      smsOptIn: args.smsOptIn ?? false,
      address: args.address,
      existingVehicleIds,
      draftVehicles,
      petFeeExistingVehicleIds,
      serviceIds: args.serviceIds,
      scheduledDate,
      scheduledTime: args.scheduledTime,
      duration: pricing.duration,
      vehicleCount,
      vehicleSize,
      totalPrice: pricing.totalPrice,
      depositAmount:
        (args.paymentOption ?? "deposit") === "full"
          ? pricing.totalPrice
          : pricing.depositAmount,
      remainingBalance:
        (args.paymentOption ?? "deposit") === "full"
          ? 0
          : pricing.remainingBalance,
      paymentOption: args.paymentOption ?? "deposit",
      priceSnapshot: pricing.items,
      status: "draft",
      resumeToken,
      lastActivityAt: now,
    });

    return { draftId, resumeToken };
  },
});

export const getByIdInternal = internalQuery({
  args: {
    draftId: v.id("bookingDrafts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.draftId);
  },
});

export const getByTokenInternal = internalQuery({
  args: {
    resumeToken: v.string(),
  },
  handler: async (ctx, args) => {
    return await getDraftByToken(ctx, args.resumeToken);
  },
});

export const getByCheckoutSessionIdInternal = internalQuery({
  args: {
    checkoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingDrafts")
      .withIndex("by_checkout_session_id", (q: any) =>
        q.eq("stripeCheckoutSessionId", args.checkoutSessionId),
      )
      .first();
  },
});

export const markCheckoutOpenInternal = internalMutation({
  args: {
    draftId: v.id("bookingDrafts"),
    stripeCheckoutSessionId: v.string(),
    stripeCheckoutUrl: v.string(),
    stripeCustomerId: v.optional(v.string()),
    holdExpiresAt: v.number(),
    holdExpiryScheduledId: v.id("_scheduled_functions"),
    abandonedEmailScheduledId: v.id("_scheduled_functions"),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new Error("Booking draft not found");
    }

    await cancelScheduledDraftJobs(ctx, draft);

    await ctx.db.patch(args.draftId, {
      status: "checkout_open",
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripeCheckoutUrl: args.stripeCheckoutUrl,
      stripeCustomerId: args.stripeCustomerId,
      holdExpiresAt: args.holdExpiresAt,
      holdExpiryScheduledId: args.holdExpiryScheduledId,
      abandonedEmailScheduledId: args.abandonedEmailScheduledId,
      cancelledAt: undefined,
      expiredAt: undefined,
      completedAt: undefined,
      convertedAt: undefined,
      lastActivityAt: Date.now(),
    });
  },
});

export const markCancelledInternal = internalMutation({
  args: {
    draftId: v.id("bookingDrafts"),
  },
  returns: v.union(v.null(), v.object({ resumeToken: v.string() })),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      return null;
    }
    if (draft.status === "converted") {
      return { resumeToken: draft.resumeToken };
    }

    await cancelScheduledDraftJobs(ctx, draft);
    await ctx.db.patch(args.draftId, {
      status: "cancelled",
      cancelledAt: Date.now(),
      holdExpiryScheduledId: undefined,
      abandonedEmailScheduledId: undefined,
      holdExpiresAt: undefined,
      lastActivityAt: Date.now(),
    });

    return { resumeToken: draft.resumeToken };
  },
});

export const markExpiredInternal = internalMutation({
  args: {
    draftId: v.id("bookingDrafts"),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.status === "converted") {
      return null;
    }

    await cancelScheduledDraftJobs(ctx, draft);
    await ctx.db.patch(args.draftId, {
      status: "expired",
      expiredAt: Date.now(),
      holdExpiryScheduledId: undefined,
      abandonedEmailScheduledId: undefined,
      holdExpiresAt: undefined,
      lastActivityAt: Date.now(),
    });

    return null;
  },
});

export const markAbandonedEmailSentInternal = internalMutation({
  args: {
    draftId: v.id("bookingDrafts"),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      return null;
    }

    await ctx.db.patch(args.draftId, {
      abandonedEmailSentAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    return null;
  },
});

export const convertSuccessfulCheckout = internalMutation({
  args: {
    draftId: v.id("bookingDrafts"),
    stripeCustomerId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      appointmentId: v.id("appointments"),
      invoiceId: v.id("invoices"),
      userId: v.id("users"),
      paymentOption: bookingPaymentOptionValidator,
      isFullPayment: v.boolean(),
      total: v.number(),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<ConvertedDraftResult | null> => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      return null;
    }

    if (draft.status === "converted" && draft.convertedAppointmentId && draft.convertedInvoiceId && draft.convertedUserId) {
      return {
        appointmentId: draft.convertedAppointmentId,
        invoiceId: draft.convertedInvoiceId,
        userId: draft.convertedUserId,
        paymentOption: draft.paymentOption,
        isFullPayment: draft.paymentOption === "full",
        total: draft.totalPrice,
      };
    }

    await cancelScheduledDraftJobs(ctx, draft);
    await ctx.db.patch(draft._id, {
      status: "completed",
      completedAt: Date.now(),
      holdExpiryScheduledId: undefined,
      abandonedEmailScheduledId: undefined,
      holdExpiresAt: undefined,
      lastActivityAt: Date.now(),
    });

    let user =
      (draft.sourceUserId ? await ctx.db.get(draft.sourceUserId) : null) ??
      (await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", draft.customerEmail))
        .first());

    const now = Date.now();
    if (user) {
      const updates: Record<string, unknown> = {};
      if (!user.name || user.name === user.email) {
        updates.name = draft.customerName;
      }
      if (!user.phone) {
        updates.phone = draft.customerPhone;
      }
      if (!user.address) {
        updates.address = {
          street: draft.address.street,
          city: draft.address.city,
          state: draft.address.state,
          zip: draft.address.zip,
        };
      }
      if (args.stripeCustomerId && !user.stripeCustomerId) {
        updates.stripeCustomerId = args.stripeCustomerId;
      }
      updates.notificationPreferences = buildUpdatedNotificationPreferences(
        user.notificationPreferences,
        draft.smsOptIn ?? false,
        now,
      );
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(user._id, updates);
        user = {
          ...user,
          ...updates,
        } as Doc<"users">;
      }
    } else {
      const userId = await ctx.db.insert("users", {
        name: draft.customerName,
        email: draft.customerEmail,
        phone: draft.customerPhone,
        address: {
          street: draft.address.street,
          city: draft.address.city,
          state: draft.address.state,
          zip: draft.address.zip,
        },
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
        cancellationCount: 0,
        stripeCustomerId: args.stripeCustomerId,
        notificationPreferences: buildBookingNotificationPreferences(
          draft.smsOptIn ?? false,
          now,
        ),
      });
      user = await ctx.db.get(userId);
    }

    if (!user) {
      throw new Error("Unable to create booking user");
    }

    const createdVehicleIds: Id<"vehicles">[] = [];
    const createdPetFeeVehicleIds: Id<"vehicles">[] = [];
    for (const draftVehicle of draft.draftVehicles) {
      const vehicleId = await ctx.db.insert("vehicles", {
        userId: user._id,
        year: draftVehicle.year,
        make: draftVehicle.make,
        model: draftVehicle.model,
        size: draftVehicle.size,
        color: draftVehicle.color,
        licensePlate: draftVehicle.licensePlate,
      });
      createdVehicleIds.push(vehicleId);
      if (draftVehicle.hasPet) {
        createdPetFeeVehicleIds.push(vehicleId);
      }
    }

    const existingVehicles = await Promise.all(
      draft.existingVehicleIds.map((vehicleId) => ctx.db.get(vehicleId)),
    );
    const validExistingVehicleIds = existingVehicles
      .filter(
        (vehicle): vehicle is NonNullable<typeof vehicle> =>
          vehicle !== null && vehicle.userId === user._id,
      )
      .map((vehicle) => vehicle._id);

    if (validExistingVehicleIds.length !== draft.existingVehicleIds.length) {
      throw new Error(
        "One or more selected vehicles are no longer available. Please contact support so we can finalize this booking.",
      );
    }

    const vehicleIds = [...validExistingVehicleIds, ...createdVehicleIds] as Id<"vehicles">[];
    if (vehicleIds.length === 0) {
      throw new Error("Bookings require at least one vehicle.");
    }
    const validExistingPetFeeVehicleIds = validExistingVehicleIds.filter((vehicleId) =>
      (draft.petFeeExistingVehicleIds ?? []).includes(vehicleId),
    );
    const petFeeVehicleIds = [
      ...validExistingPetFeeVehicleIds,
      ...createdPetFeeVehicleIds,
    ];

    const appointmentId = await ctx.db.insert("appointments", {
      userId: user._id,
      vehicleIds,
      serviceIds: draft.serviceIds,
      scheduledDate: draft.scheduledDate,
      scheduledTime: draft.scheduledTime,
      duration: draft.duration,
      location: {
        street: draft.address.street,
        city: draft.address.city,
        state: draft.address.state,
        zip: draft.address.zip,
        notes: draft.address.notes,
      },
      status: "pending",
      totalPrice: draft.totalPrice,
      notes: "Created via checkout conversion",
      createdBy: user._id,
      paymentOption: draft.paymentOption,
      petFeeVehicleIds,
    });

    const invoiceCountResult: { count: number } = await ctx.runQuery(
      internal.invoices.getCountInternal,
      {},
    );
    const invoiceNumber: string = `INV-${String(invoiceCountResult.count + 1).padStart(4, "0")}`;
    const dueDate = new Date(`${draft.scheduledDate}T00:00:00.000Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() + 30);
    const today = new Date().toISOString().split("T")[0];
    const isFullPayment = draft.paymentOption === "full";

    const invoiceId: Id<"invoices"> = await ctx.db.insert("invoices", {
      appointmentId,
      userId: user._id,
      invoiceNumber,
      items: draft.priceSnapshot,
      subtotal: draft.totalPrice,
      tax: 0,
      total: draft.totalPrice,
      status: isFullPayment ? "paid" : "draft",
      dueDate: dueDate.toISOString().split("T")[0],
      paidDate: isFullPayment ? today : undefined,
      notes: `Invoice for appointment on ${draft.scheduledDate}`,
      depositAmount: draft.paymentOption === "full" ? draft.totalPrice : draft.depositAmount,
      depositPaid: true,
      depositPaymentIntentId: args.paymentIntentId,
      remainingBalance: isFullPayment ? 0 : draft.remainingBalance,
      paymentOption: draft.paymentOption,
      remainingBalanceCollectionMethod:
        draft.paymentOption === "deposit" ? "send_invoice" : undefined,
    });

    await ctx.db.patch(draft._id, {
      sourceUserId: user._id,
      status: "converted",
      convertedAt: Date.now(),
      convertedUserId: user._id,
      convertedAppointmentId: appointmentId,
      convertedInvoiceId: invoiceId,
      stripeCustomerId: args.stripeCustomerId ?? draft.stripeCustomerId,
      lastActivityAt: Date.now(),
    });

    return {
      appointmentId,
      invoiceId,
      userId: user._id,
      paymentOption: draft.paymentOption,
      isFullPayment,
      total: draft.totalPrice,
    };
  },
});

export const getPublicContext = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const draft = await getDraftByToken(ctx, args.token);
    if (!draft) {
      return null;
    }

    const services = await getServicesForDraft(ctx, draft.serviceIds);

    return {
      token: draft.resumeToken,
      status: draft.status,
      email: draft.customerEmail,
      name: draft.customerName,
      phone: draft.customerPhone,
      smsOptIn: draft.smsOptIn ?? false,
      scheduledDate: draft.scheduledDate,
      scheduledTime: draft.scheduledTime,
      serviceIds: draft.serviceIds,
      serviceNames: services.map((service) => service.name),
      address: draft.address,
      vehicles: draft.draftVehicles.map((vehicle) => ({
        year: String(vehicle.year),
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
        size: vehicle.size,
        hasPet: vehicle.hasPet ?? false,
      })),
      existingVehicleIds: draft.existingVehicleIds,
      petFeeExistingVehicleIds: draft.petFeeExistingVehicleIds ?? [],
      paymentOption: draft.paymentOption,
      convertedAppointmentId: draft.convertedAppointmentId,
      convertedInvoiceId: draft.convertedInvoiceId,
      convertedUserId: draft.convertedUserId,
      abandonedEmailSentAt: draft.abandonedEmailSentAt,
      cancelledAt: draft.cancelledAt,
      expiredAt: draft.expiredAt,
    };
  },
});

export const claimConvertedDraft = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    redirectPath: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new ConvexError("You need to sign in before claiming this booking.");
    }

    const draft = await getDraftByToken(ctx, args.token);
    if (!draft || !draft.convertedUserId) {
      throw new ConvexError(
        "We’re still finalizing this booking. Please refresh in a moment.",
      );
    }

    const currentUserId = await getUserIdFromIdentity(ctx);
    const normalizedDraftEmail = normalizeEmail(draft.customerEmail);
    const normalizedIdentityEmail = normalizeEmail(
      getNormalizedIdentityEmail(identity),
    );

    if (
      draft.claimedAt &&
      draft.claimedByClerkUserId &&
      draft.claimedByClerkUserId !== identity.subject
    ) {
      throw new ConvexError("This booking has already been claimed.");
    }

    if (currentUserId && currentUserId !== draft.convertedUserId) {
      throw new ConvexError(
        "This signed-in account is already linked to a different customer record. Please sign in with the booking email instead.",
      );
    }

    if (!currentUserId && normalizedIdentityEmail !== normalizedDraftEmail) {
      throw new ConvexError(
        `This booking was created with ${draft.customerEmail}. Sign in or create an account with that email to attach it.`,
      );
    }

    const bookingUser = await ctx.db.get(draft.convertedUserId);
    if (!bookingUser) {
      throw new ConvexError("We couldn't find the booking attached to this link.");
    }

    if (
      bookingUser.clerkUserId &&
      bookingUser.clerkUserId !== identity.subject &&
      currentUserId !== bookingUser._id
    ) {
      throw new ConvexError(
        "This booking is already linked to another account. Please contact support if that looks wrong.",
      );
    }

    if (!bookingUser.clerkUserId) {
      await ctx.db.patch(bookingUser._id, {
        clerkUserId: identity.subject,
      });
    }

    if (!draft.claimedAt) {
      await ctx.db.patch(draft._id, {
        claimedAt: Date.now(),
        claimedByClerkUserId: identity.subject,
        lastActivityAt: Date.now(),
      });
    }

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q: any) => q.eq("userId", bookingUser._id))
      .collect();

    const onboardingComplete = Boolean(
      bookingUser.name &&
        bookingUser.phone &&
        bookingUser.address &&
        vehicles.length > 0,
    );

    return {
      redirectPath: buildClaimRedirectPath(onboardingComplete),
    };
  },
});

export const listAbandonedForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const drafts = await ctx.db.query("bookingDrafts").collect();
    return await Promise.all(
      drafts
      .filter((draft) => {
        if (draft.status === "draft") {
          return false;
        }
        if (draft.status === "converted") {
          return Boolean(draft.abandonedEmailSentAt);
        }
        return true;
      })
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .slice(0, 100)
      .map(async (draft) => {
        const services = await getServicesForDraft(ctx, draft.serviceIds);
        return {
        _id: draft._id,
        email: draft.customerEmail,
        name: draft.customerName,
        phone: draft.customerPhone,
        scheduledDate: draft.scheduledDate,
        scheduledTime: draft.scheduledTime,
        status: draft.status,
        paymentOption: draft.paymentOption,
        totalPrice: draft.totalPrice,
        serviceNames: services.map((service) => service.name),
        resumeToken: draft.resumeToken,
        abandonedEmailSentAt: draft.abandonedEmailSentAt,
        holdExpiresAt: draft.holdExpiresAt,
        lastActivityAt: draft.lastActivityAt,
        recovered: draft.status === "converted",
        };
      }),
    );
  },
});

export const repairLegacyPendingBookings = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const dryRun = args.dryRun ?? true;
    const appointments = await ctx.db.query("appointments").collect();
    const invoices = await ctx.db.query("invoices").collect();
    const invoiceByAppointment = new Map(
      invoices.map((invoice) => [invoice.appointmentId, invoice]),
    );

    const candidates = appointments.filter((appointment) => {
      const invoice = invoiceByAppointment.get(appointment._id);
      return (
        appointment.status === "pending" &&
        appointment.notes === "Created via marketing site booking" &&
        !!invoice &&
        !invoice.depositPaid &&
        invoice.status === "draft" &&
        !invoice.paidDate &&
        !invoice.stripePaymentIntentId &&
        !invoice.depositPaymentIntentId &&
        !invoice.finalPaymentIntentId &&
        !invoice.stripeInvoiceId
      );
    });

    const summary = {
      scanned: appointments.length,
      candidates: candidates.length,
      removedAppointments: 0,
      removedInvoices: 0,
      removedVehicles: 0,
      dryRun,
    };

    if (dryRun) {
      return summary;
    }

    for (const appointment of candidates) {
      const invoice = invoiceByAppointment.get(appointment._id);
      if (appointment.reminderScheduledId) {
        await ctx.scheduler.cancel(appointment.reminderScheduledId);
      }
      if (invoice) {
        await ctx.db.delete(invoice._id);
        summary.removedInvoices += 1;
      }
      await ctx.db.delete(appointment._id);
      summary.removedAppointments += 1;

      for (const vehicleId of appointment.vehicleIds) {
        const vehicle = await ctx.db.get(vehicleId);
        if (!vehicle) {
          continue;
        }
        const otherAppointments = (await ctx.db.query("appointments").collect()).filter(
          (otherAppointment) =>
            otherAppointment._id !== appointment._id &&
            otherAppointment.vehicleIds.includes(vehicleId),
        );
        if (otherAppointments.length > 0) {
          continue;
        }
        const siblingVehicles = await ctx.db
          .query("vehicles")
          .withIndex("by_user", (q: any) => q.eq("userId", vehicle.userId))
          .collect();
        const duplicate = siblingVehicles.find(
          (candidate) =>
            candidate._id !== vehicle._id &&
            candidate.year === vehicle.year &&
            candidate.make === vehicle.make &&
            candidate.model === vehicle.model &&
            (candidate.color ?? "") === (vehicle.color ?? "") &&
            (candidate.licensePlate ?? "") === (vehicle.licensePlate ?? ""),
        );
        if (duplicate) {
          await ctx.db.delete(vehicle._id);
          summary.removedVehicles += 1;
        }
      }
    }

    return summary;
  },
});

export const getSchedulerDefaults = query({
  args: {},
  handler: async () => {
    return {
      holdDurationMs: HOLD_DURATION_MS,
      abandonedEmailDelayMs: ABANDONED_EMAIL_DELAY_MS,
    };
  },
});
