import { ConvexError, v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUserIdFromIdentity, requireAdmin } from "./auth";
import { internal } from "./_generated/api";
import { r2 } from "./r2";

const tripLogStatusValidator = v.union(v.literal("draft"), v.literal("completed"));
const tripLogSourceValidator = v.union(v.literal("manual"), v.literal("appointment"));
const mileageSourceValidator = v.union(
  v.literal("radar"),
  v.literal("manual_override"),
  v.literal("manual"),
);

const locationInputValidator = v.object({
  addressLabel: v.optional(v.string()),
  street: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
});

const routeGeoJsonValidator = v.object({
  type: v.literal("LineString"),
  coordinates: v.array(v.array(v.number())),
});

const mileageInputValidator = v.object({
  radarMiles: v.optional(v.number()),
  finalMiles: v.optional(v.number()),
  mileageSource: v.optional(mileageSourceValidator),
  mileageOverrideReason: v.optional(v.string()),
});

const RECEIPT_ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const RECEIPT_ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

type LocationInput = {
  addressLabel?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

type MileageInput = {
  radarMiles?: number;
  finalMiles?: number;
  mileageSource?: "radar" | "manual_override" | "manual";
  mileageOverrideReason?: string;
};

function shouldScheduleNotificationJobs(): boolean {
  return process.env.CONVEX_TEST !== "true" && process.env.NODE_ENV !== "test";
}

function hasText(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

function normalizeContentType(contentType: string): string {
  return contentType.toLowerCase().split(";")[0]?.trim() || "";
}

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");
  if (lastDotIndex < 0) {
    return "";
  }
  return normalized.slice(lastDotIndex);
}

function isAllowedReceiptFile(fileName: string, contentType: string): boolean {
  const normalizedContentType = normalizeContentType(contentType);
  const extension = getFileExtension(fileName);
  return (
    RECEIPT_ALLOWED_CONTENT_TYPES.has(normalizedContentType) &&
    RECEIPT_ALLOWED_EXTENSIONS.has(extension)
  );
}

function validateReceiptFile(fileName: string, contentType: string) {
  if (!isAllowedReceiptFile(fileName, contentType)) {
    throw new ConvexError({
      code: "INVALID_RECEIPT_FILE_TYPE",
      message: "Only JPG, PNG, WEBP, and GIF image receipts are allowed.",
    });
  }
}

function sanitizeLocation(input: LocationInput): LocationInput {
  return {
    addressLabel: input.addressLabel?.trim() || undefined,
    street: input.street?.trim() || undefined,
    city: input.city?.trim() || undefined,
    state: input.state?.trim() || undefined,
    postalCode: input.postalCode?.trim() || undefined,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}

function formatLocationForSearch(input: LocationInput): string {
  const parts = [
    input.addressLabel,
    input.street,
    input.city,
    input.state,
    input.postalCode,
  ].filter((part) => hasText(part));
  return parts.join(", ");
}

function assertValidStops(stops: Array<LocationInput>) {
  if (stops.length === 0) {
    throw new ConvexError({
      code: "INVALID_TRIP_STOPS",
      message: "At least one destination stop is required.",
    });
  }
}

function roundMiles(value: number): number {
  return Math.round(value * 100) / 100;
}

function hasLocationData(location: LocationInput | undefined | null): boolean {
  if (!location) return false;
  if (
    location.latitude !== undefined &&
    location.longitude !== undefined &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    return true;
  }
  return Boolean(
    hasText(location.addressLabel) ||
      hasText(location.street) ||
      hasText(location.city) ||
      hasText(location.state) ||
      hasText(location.postalCode),
  );
}

function normalizeMileageInput(input: MileageInput): {
  radarMiles?: number;
  finalMiles?: number;
  mileageSource: "radar" | "manual_override" | "manual";
  mileageOverrideReason?: string;
} {
  const radarMiles =
    input.radarMiles !== undefined ? roundMiles(Math.max(0, input.radarMiles)) : undefined;
  const finalMilesCandidate =
    input.finalMiles !== undefined ? roundMiles(Math.max(0, input.finalMiles)) : undefined;
  const finalMiles = finalMilesCandidate ?? radarMiles;

  let mileageSource = input.mileageSource ?? (radarMiles !== undefined ? "radar" : "manual");
  if (
    radarMiles !== undefined &&
    finalMiles !== undefined &&
    Math.abs(finalMiles - radarMiles) > 0.01
  ) {
    mileageSource = "manual_override";
  }

  const mileageOverrideReason = input.mileageOverrideReason?.trim() || undefined;
  if (mileageSource === "manual_override" && !mileageOverrideReason) {
    throw new ConvexError({
      code: "MILEAGE_OVERRIDE_REASON_REQUIRED",
      message: "A reason is required when overriding Radar mileage.",
    });
  }

  return {
    radarMiles,
    finalMiles,
    mileageSource,
    mileageOverrideReason:
      mileageSource === "manual_override" ? mileageOverrideReason : undefined,
  };
}

async function requireAdminActorId(ctx: any): Promise<Id<"users">> {
  await requireAdmin(ctx);
  const actorId = await getUserIdFromIdentity(ctx);
  if (!actorId) {
    throw new ConvexError({
      code: "NOT_AUTHENTICATED",
      message: "Not authenticated",
    });
  }
  return actorId;
}

async function recomputeExpenseTotals(
  ctx: any,
  tripLogId: Id<"tripLogs">,
  updatedBy: Id<"users">,
) {
  const expenses = await ctx.db
    .query("tripLogExpenses")
    .withIndex("by_trip_log", (q: any) => q.eq("tripLogId", tripLogId))
    .collect();
  const expenseTotalCents = expenses.reduce(
    (sum: number, expense: Doc<"tripLogExpenses">) => sum + expense.amountCents,
    0,
  );
  await ctx.db.patch(tripLogId, {
    expenseTotalCents,
    updatedAt: Date.now(),
    updatedBy,
  });
}

async function resolveActorForSystemWrite(ctx: any, fallbackUserId: Id<"users">) {
  const firstAdmin = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "admin"))
    .first();
  return firstAdmin?._id || fallbackUserId;
}

function milesFromDistance(distance: any): number {
  if (!distance) return 0;
  if (typeof distance.text === "string") {
    const text = distance.text.toLowerCase();
    const numeric = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric)) {
      if (text.includes("mi")) return numeric;
      if (text.includes("ft")) return numeric / 5280;
      if (text.includes("km")) return numeric / 1.60934;
      if (text.includes("m")) return numeric / 1609.34;
    }
  }

  if (typeof distance.value === "number" && Number.isFinite(distance.value)) {
    // Radar distance value may be meters even when units are imperial.
    if (distance.value > 1000) {
      return distance.value / 1609.34;
    }
    return distance.value;
  }

  return 0;
}

async function resolveLocationWithRadar(
  location: LocationInput,
  radarSecretKey: string,
): Promise<LocationInput> {
  if (
    location.latitude !== undefined &&
    location.longitude !== undefined &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    return sanitizeLocation(location);
  }

  const query = formatLocationForSearch(location);
  if (!query) {
    throw new ConvexError({
      code: "INVALID_LOCATION",
      message: "Address text is required when latitude/longitude are missing.",
    });
  }

  const geocodeResponse = await fetch(
    `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(query)}&limit=1&country=US`,
    {
      method: "GET",
      headers: {
        Authorization: radarSecretKey,
      },
    },
  );

  if (!geocodeResponse.ok) {
    const errorText = await geocodeResponse.text();
    throw new ConvexError({
      code: "RADAR_GEOCODE_FAILED",
      message: `Failed to validate address with Radar: ${errorText || geocodeResponse.statusText}`,
    });
  }

  const geocodePayload: any = await geocodeResponse.json();
  const first = geocodePayload.addresses?.[0];
  if (!first) {
    throw new ConvexError({
      code: "RADAR_GEOCODE_EMPTY",
      message: "Radar could not resolve one of the addresses.",
    });
  }

  return sanitizeLocation({
    addressLabel: first.formattedAddress || first.addressLabel,
    street: first.street,
    city: first.city,
    state: first.stateCode || first.state,
    postalCode: first.postalCode,
    latitude: first.latitude,
    longitude: first.longitude,
  });
}

export const list = query({
  args: {
    status: v.optional(tripLogStatusValidator),
    source: v.optional(tripLogSourceValidator),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    appointmentId: v.optional(v.id("appointments")),
    requiredOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let logs: Array<Doc<"tripLogs">> = [];

    if (args.appointmentId) {
      logs = await ctx.db
        .query("tripLogs")
        .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
        .collect();
    } else if (args.status && args.requiredOnly) {
      logs = await ctx.db
        .query("tripLogs")
        .withIndex("by_required_and_status", (q) =>
          q.eq("requiredForAppointment", true).eq("status", args.status!),
        )
        .collect();
    } else if (args.status) {
      logs = await ctx.db
        .query("tripLogs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else if (args.source) {
      logs = await ctx.db
        .query("tripLogs")
        .withIndex("by_source", (q) => q.eq("source", args.source!))
        .collect();
    } else if (args.fromDate || args.toDate) {
      const fromDate = args.fromDate;
      const toDate = args.toDate;
      logs = await ctx.db
        .query("tripLogs")
        .withIndex("by_log_date", (q) => {
          if (fromDate && toDate) {
            return q.gte("logDate", fromDate).lte("logDate", toDate);
          }
          if (fromDate) {
            return q.gte("logDate", fromDate);
          }
          if (toDate) {
            return q.lte("logDate", toDate);
          }
          return q;
        })
        .collect();
    } else {
      logs = await ctx.db
        .query("tripLogs")
        .withIndex("by_log_date", (q) => q)
        .collect();
    }

    if (args.requiredOnly !== undefined) {
      logs = logs.filter((log) => log.requiredForAppointment === args.requiredOnly);
    }
    if (args.status && !(args.status && args.requiredOnly)) {
      logs = logs.filter((log) => log.status === args.status);
    }
    if (args.source && !args.appointmentId) {
      logs = logs.filter((log) => log.source === args.source);
    }
    if (args.fromDate) {
      logs = logs.filter((log) => log.logDate >= args.fromDate!);
    }
    if (args.toDate) {
      logs = logs.filter((log) => log.logDate <= args.toDate!);
    }

    logs.sort((a, b) => {
      if (a.logDate === b.logDate) {
        return b.updatedAt - a.updatedAt;
      }
      return b.logDate.localeCompare(a.logDate);
    });

    return await Promise.all(
      logs.map(async (log) => {
        const expenses = await ctx.db
          .query("tripLogExpenses")
          .withIndex("by_trip_log", (q) => q.eq("tripLogId", log._id))
          .collect();

        let appointmentSummary: null | {
          _id: Id<"appointments">;
          scheduledDate: string;
          scheduledTime: string;
          status: Doc<"appointments">["status"];
          customerName?: string;
          customerEmail?: string;
        } = null;

        if (log.appointmentId) {
          const appointment = await ctx.db.get(log.appointmentId);
          if (appointment) {
            const customer = await ctx.db.get(appointment.userId);
            appointmentSummary = {
              _id: appointment._id,
              scheduledDate: appointment.scheduledDate,
              scheduledTime: appointment.scheduledTime,
              status: appointment.status,
              customerName: customer?.name || undefined,
              customerEmail: customer?.email || undefined,
            };
          }
        }

        return {
          ...log,
          expenseCount: expenses.length,
          appointment: appointmentSummary,
        };
      }),
    );
  },
});

export const getById = query({
  args: { tripLogId: v.id("tripLogs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const tripLog = await ctx.db.get(args.tripLogId);
    if (!tripLog) {
      return null;
    }

    const expenses = await ctx.db
      .query("tripLogExpenses")
      .withIndex("by_trip_log", (q) => q.eq("tripLogId", tripLog._id))
      .collect();

    const expensesWithPresentation = await Promise.all(
      expenses.map(async (expense) => {
        const receipts = await Promise.all(
          expense.receipts.map(async (receipt) => {
            const isImage = isAllowedReceiptFile(receipt.fileName, receipt.contentType);
            let signedUrl: string | undefined;
            if (isImage) {
              try {
                signedUrl = await r2.getUrl(receipt.key, { expiresIn: 60 * 60 * 24 });
              } catch (error) {
                console.warn(`[tripLogs] Failed to sign receipt URL ${receipt.key}`, error);
              }
            }
            return {
              ...receipt,
              isImage,
              signedUrl,
            };
          }),
        );
        return {
          ...expense,
          receipts,
        };
      }),
    );

    const appointment = tripLog.appointmentId ? await ctx.db.get(tripLog.appointmentId) : null;
    const appointmentUser = appointment ? await ctx.db.get(appointment.userId) : null;
    const appointmentSummary = appointment
      ? {
          _id: appointment._id,
          scheduledDate: appointment.scheduledDate,
          scheduledTime: appointment.scheduledTime,
          status: appointment.status,
          customerName: appointmentUser?.name || undefined,
          customerEmail: appointmentUser?.email || undefined,
        }
      : null;

    return {
      ...tripLog,
      expenses: expensesWithPresentation,
      appointment,
      appointmentUser,
      appointmentSummary,
    };
  },
});

export const getByIdInternal = internalQuery({
  args: { tripLogId: v.id("tripLogs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tripLogId);
  },
});

export const getByAppointment = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const logs = await ctx.db
      .query("tripLogs")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .collect();
    return logs.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getPendingRequiredCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const pending = await ctx.db
      .query("tripLogs")
      .withIndex("by_required_and_status", (q) =>
        q.eq("requiredForAppointment", true).eq("status", "draft"),
      )
      .collect();
    return pending.length;
  },
});

export const getPendingRequired = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
    const pending = await ctx.db
      .query("tripLogs")
      .withIndex("by_required_and_status", (q) =>
        q.eq("requiredForAppointment", true).eq("status", "draft"),
      )
      .take(limit);

    return await Promise.all(
      pending.map(async (log) => {
        if (!log.appointmentId) {
          return { ...log, appointment: null as null };
        }
        const appointment = await ctx.db.get(log.appointmentId);
        if (!appointment) {
          return { ...log, appointment: null as null };
        }
        const user = await ctx.db.get(appointment.userId);
        return {
          ...log,
          appointment: {
            _id: appointment._id,
            scheduledDate: appointment.scheduledDate,
            scheduledTime: appointment.scheduledTime,
            status: appointment.status,
            customerName: user?.name || undefined,
            customerEmail: user?.email || undefined,
          },
        };
      }),
    );
  },
});

export const createManualDraft = mutation({
  args: {
    logDate: v.string(),
    start: locationInputValidator,
    stops: v.array(locationInputValidator),
    businessPurpose: v.string(),
    mileage: mileageInputValidator,
  },
  returns: v.id("tripLogs"),
  handler: async (ctx, args) => {
    const actorId = await requireAdminActorId(ctx);
    assertValidStops(args.stops);
    if (!hasText(args.businessPurpose)) {
      throw new ConvexError({
        code: "BUSINESS_PURPOSE_REQUIRED",
        message: "Business purpose is required.",
      });
    }

    const normalizedMileage = normalizeMileageInput(args.mileage);
    const now = Date.now();

    return await ctx.db.insert("tripLogs", {
      source: "manual",
      requiredForAppointment: false,
      status: "draft",
      logDate: args.logDate,
      businessPurpose: args.businessPurpose.trim(),
      start: sanitizeLocation(args.start),
      stops: args.stops.map(sanitizeLocation),
      radarMiles: normalizedMileage.radarMiles,
      finalMiles: normalizedMileage.finalMiles,
      mileageSource: normalizedMileage.mileageSource,
      mileageOverrideReason: normalizedMileage.mileageOverrideReason,
      expenseTotalCents: 0,
      createdBy: actorId,
      updatedBy: actorId,
      updatedAt: now,
    });
  },
});

export const updateDraft = mutation({
  args: {
    tripLogId: v.id("tripLogs"),
    logDate: v.optional(v.string()),
    start: v.optional(locationInputValidator),
    stops: v.optional(v.array(locationInputValidator)),
    businessPurpose: v.optional(v.string()),
    mileage: v.optional(mileageInputValidator),
    routeArtifactKey: v.optional(v.string()),
    routeComputedAt: v.optional(v.number()),
  },
  returns: v.id("tripLogs"),
  handler: async (ctx, args) => {
    const actorId = await requireAdminActorId(ctx);
    const existing = await ctx.db.get(args.tripLogId);
    if (!existing) {
      throw new ConvexError({
        code: "TRIP_LOG_NOT_FOUND",
        message: "Trip log not found.",
      });
    }
    if (existing.status !== "draft") {
      throw new ConvexError({
        code: "TRIP_LOG_NOT_EDITABLE",
        message: "Only draft logs can be edited.",
      });
    }

    if (args.stops) {
      assertValidStops(args.stops);
    }

    const mergedMileage = args.mileage
      ? normalizeMileageInput({
          radarMiles: args.mileage.radarMiles ?? existing.radarMiles,
          finalMiles: args.mileage.finalMiles ?? existing.finalMiles,
          mileageSource: args.mileage.mileageSource ?? existing.mileageSource,
          mileageOverrideReason:
            args.mileage.mileageOverrideReason ?? existing.mileageOverrideReason,
        })
      : {
          radarMiles: existing.radarMiles,
          finalMiles: existing.finalMiles,
          mileageSource: existing.mileageSource,
          mileageOverrideReason: existing.mileageOverrideReason,
        };

    await ctx.db.patch(args.tripLogId, {
      logDate: args.logDate ?? existing.logDate,
      start: args.start ? sanitizeLocation(args.start) : existing.start,
      stops: args.stops ? args.stops.map(sanitizeLocation) : existing.stops,
      businessPurpose: hasText(args.businessPurpose)
        ? args.businessPurpose!.trim()
        : existing.businessPurpose,
      radarMiles: mergedMileage.radarMiles,
      finalMiles: mergedMileage.finalMiles,
      mileageSource: mergedMileage.mileageSource,
      mileageOverrideReason: mergedMileage.mileageOverrideReason,
      routeArtifactKey: args.routeArtifactKey ?? existing.routeArtifactKey,
      routeComputedAt: args.routeComputedAt ?? existing.routeComputedAt,
      updatedBy: actorId,
      updatedAt: Date.now(),
    });

    return args.tripLogId;
  },
});

export const markCompleted = mutation({
  args: {
    tripLogId: v.id("tripLogs"),
  },
  returns: v.id("tripLogs"),
  handler: async (ctx, args) => {
    const actorId = await requireAdminActorId(ctx);
    const tripLog = await ctx.db.get(args.tripLogId);
    if (!tripLog) {
      throw new ConvexError({
        code: "TRIP_LOG_NOT_FOUND",
        message: "Trip log not found.",
      });
    }
    if (tripLog.status === "completed") {
      return args.tripLogId;
    }
    if (!hasText(tripLog.businessPurpose)) {
      throw new ConvexError({
        code: "BUSINESS_PURPOSE_REQUIRED",
        message: "Business purpose is required.",
      });
    }
    if (tripLog.stops.length === 0) {
      throw new ConvexError({
        code: "INVALID_TRIP_STOPS",
        message: "At least one destination stop is required.",
      });
    }
    if (!hasLocationData(tripLog.start)) {
      throw new ConvexError({
        code: "START_LOCATION_REQUIRED",
        message: "Start location is required before completing the log.",
      });
    }
    if (tripLog.stops.some((stop) => !hasLocationData(stop))) {
      throw new ConvexError({
        code: "DESTINATION_LOCATION_REQUIRED",
        message: "All destination locations must be provided before completing the log.",
      });
    }
    if (tripLog.finalMiles === undefined || tripLog.finalMiles <= 0) {
      throw new ConvexError({
        code: "MILEAGE_REQUIRED",
        message: "Final mileage is required before completing the log.",
      });
    }
    if (
      tripLog.radarMiles !== undefined &&
      Math.abs((tripLog.finalMiles ?? 0) - tripLog.radarMiles) > 0.01 &&
      !hasText(tripLog.mileageOverrideReason)
    ) {
      throw new ConvexError({
        code: "MILEAGE_OVERRIDE_REASON_REQUIRED",
        message: "Provide an override reason when final mileage differs from Radar mileage.",
      });
    }

    await ctx.db.patch(args.tripLogId, {
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: actorId,
    });

    return args.tripLogId;
  },
});

export const reopen = mutation({
  args: {
    tripLogId: v.id("tripLogs"),
  },
  returns: v.id("tripLogs"),
  handler: async (ctx, args) => {
    const actorId = await requireAdminActorId(ctx);
    const tripLog = await ctx.db.get(args.tripLogId);
    if (!tripLog) {
      throw new ConvexError({
        code: "TRIP_LOG_NOT_FOUND",
        message: "Trip log not found.",
      });
    }

    await ctx.db.patch(args.tripLogId, {
      status: "draft",
      completedAt: undefined,
      updatedAt: Date.now(),
      updatedBy: actorId,
    });
    return args.tripLogId;
  },
});

export const upsertExpenseLine = mutation({
  args: {
    expenseId: v.optional(v.id("tripLogExpenses")),
    tripLogId: v.id("tripLogs"),
    incurredDate: v.string(),
    category: v.string(),
    amountCents: v.number(),
    notes: v.optional(v.string()),
    merchant: v.optional(v.string()),
  },
  returns: v.id("tripLogExpenses"),
  handler: async (ctx, args) => {
    const actorId = await requireAdminActorId(ctx);
    const tripLog = await ctx.db.get(args.tripLogId);
    if (!tripLog) {
      throw new ConvexError({
        code: "TRIP_LOG_NOT_FOUND",
        message: "Trip log not found.",
      });
    }
    if (args.amountCents <= 0) {
      throw new ConvexError({
        code: "INVALID_EXPENSE_AMOUNT",
        message: "Expense amount must be greater than zero.",
      });
    }

    let expenseId = args.expenseId;
    if (expenseId) {
      const existingExpense = await ctx.db.get(expenseId);
      if (!existingExpense || existingExpense.tripLogId !== args.tripLogId) {
        throw new ConvexError({
          code: "EXPENSE_NOT_FOUND",
          message: "Expense not found for this trip log.",
        });
      }
      await ctx.db.patch(expenseId, {
        incurredDate: args.incurredDate,
        category: args.category.trim(),
        amountCents: Math.round(args.amountCents),
        notes: args.notes?.trim() || undefined,
        merchant: args.merchant?.trim() || undefined,
      });
    } else {
      expenseId = await ctx.db.insert("tripLogExpenses", {
        tripLogId: args.tripLogId,
        incurredDate: args.incurredDate,
        category: args.category.trim(),
        amountCents: Math.round(args.amountCents),
        notes: args.notes?.trim() || undefined,
        merchant: args.merchant?.trim() || undefined,
        receipts: [],
      });
    }

    await recomputeExpenseTotals(ctx, args.tripLogId, actorId);
    return expenseId;
  },
});

export const deleteExpenseLine = mutation({
  args: {
    expenseId: v.id("tripLogExpenses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireAdminActorId(ctx);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      return null;
    }

    for (const receipt of expense.receipts) {
      try {
        await r2.deleteObject(ctx, receipt.key);
      } catch (error) {
        console.warn(
          `[tripLogs] Failed to delete R2 receipt object ${receipt.key} during expense removal`,
          error,
        );
      }
    }

    await ctx.db.delete(args.expenseId);
    const tripLog = await ctx.db.get(expense.tripLogId);
    if (tripLog) {
      await recomputeExpenseTotals(ctx, expense.tripLogId, actorId);
    }

    return null;
  },
});

export const createReceiptUploadUrl = mutation({
  args: {
    tripLogId: v.id("tripLogs"),
    expenseId: v.id("tripLogExpenses"),
    fileName: v.string(),
    contentType: v.string(),
  },
  returns: v.object({
    key: v.string(),
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);
    validateReceiptFile(args.fileName, args.contentType);
    const tripLog = await ctx.db.get(args.tripLogId);
    if (!tripLog) {
      throw new ConvexError({
        code: "TRIP_LOG_NOT_FOUND",
        message: "Trip log not found.",
      });
    }
    const expense = await ctx.db.get(args.expenseId);
    if (!expense || expense.tripLogId !== args.tripLogId) {
      throw new ConvexError({
        code: "EXPENSE_NOT_FOUND",
        message: "Expense not found for this trip log.",
      });
    }

    const sanitizedFileName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `trip-logs/${args.tripLogId}/expenses/${args.expenseId}/${Date.now()}-${sanitizedFileName}`;
    return await r2.generateUploadUrl(key);
  },
});

export const attachReceipt = mutation({
  args: {
    expenseId: v.id("tripLogExpenses"),
    key: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);
    validateReceiptFile(args.fileName, args.contentType);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      throw new ConvexError({
        code: "EXPENSE_NOT_FOUND",
        message: "Expense not found.",
      });
    }

    const existingReceipt = expense.receipts.find((receipt) => receipt.key === args.key);
    if (existingReceipt) {
      return null;
    }

    await ctx.db.patch(args.expenseId, {
      receipts: [
        ...expense.receipts,
        {
          key: args.key,
          fileName: args.fileName,
          contentType: args.contentType,
          sizeBytes: args.sizeBytes,
          uploadedAt: Date.now(),
        },
      ],
    });

    return null;
  },
});

export const removeReceipt = mutation({
  args: {
    expenseId: v.id("tripLogExpenses"),
    key: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      return null;
    }

    await ctx.db.patch(args.expenseId, {
      receipts: expense.receipts.filter((receipt) => receipt.key !== args.key),
    });

    try {
      await r2.deleteObject(ctx, args.key);
    } catch (error) {
      console.warn(`[tripLogs] Failed to delete R2 receipt object ${args.key}`, error);
    }
    return null;
  },
});

export const calculateRoute = action({
  args: {
    start: locationInputValidator,
    stops: v.array(locationInputValidator),
    tripLogId: v.optional(v.id("tripLogs")),
  },
  returns: v.object({
    start: locationInputValidator,
    stops: v.array(locationInputValidator),
    radarMiles: v.number(),
    finalMiles: v.number(),
    mileageSource: mileageSourceValidator,
    routeGeoJson: routeGeoJsonValidator,
    routeArtifactKey: v.string(),
    routeComputedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const actorId = await getUserIdFromIdentity(ctx);
    if (!actorId) {
      throw new ConvexError({
        code: "NOT_AUTHENTICATED",
        message: "Not authenticated",
      });
    }
    assertValidStops(args.stops);

    const radarSecretKey = process.env.RADAR_SECRET_KEY;
    if (!radarSecretKey) {
      throw new ConvexError({
        code: "MISSING_RADAR_SECRET_KEY",
        message: "RADAR_SECRET_KEY is not configured.",
      });
    }

    const resolvedStart = await resolveLocationWithRadar(args.start, radarSecretKey);
    const resolvedStops = await Promise.all(
      args.stops.map((stop) => resolveLocationWithRadar(stop, radarSecretKey)),
    );

    const fullRoute = [resolvedStart, ...resolvedStops];
    let totalMiles = 0;
    const mergedCoordinates: number[][] = [];

    for (let i = 0; i < fullRoute.length - 1; i += 1) {
      const origin = fullRoute[i];
      const destination = fullRoute[i + 1];
      const legResponse = await fetch(
        `https://api.radar.io/v1/route/distance?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&modes=car&units=imperial&geometry=linestring`,
        {
          method: "GET",
          headers: {
            Authorization: radarSecretKey,
          },
        },
      );

      if (!legResponse.ok) {
        const errorText = await legResponse.text();
        throw new ConvexError({
          code: "RADAR_ROUTE_FAILED",
          message: `Failed to calculate route with Radar: ${errorText || legResponse.statusText}`,
        });
      }

      const legPayload: any = await legResponse.json();
      const legRoute = legPayload.routes?.car || legPayload.routes?.geodesic;
      totalMiles += milesFromDistance(legRoute?.distance);

      const legCoordinates = legRoute?.geometry?.coordinates;
      if (Array.isArray(legCoordinates) && legCoordinates.length > 0) {
        if (mergedCoordinates.length === 0) {
          mergedCoordinates.push(...legCoordinates);
        } else {
          // Skip the first coordinate to avoid duplicating segment joins.
          mergedCoordinates.push(...legCoordinates.slice(1));
        }
      }
    }

    const normalizedMiles = roundMiles(totalMiles);
    const routeGeoJson = {
      type: "LineString" as const,
      coordinates: mergedCoordinates,
    };
    const routeComputedAt = Date.now();
    const routeArtifactPayload = {
      routeComputedAt,
      start: resolvedStart,
      stops: resolvedStops,
      radarMiles: normalizedMiles,
      routeGeoJson,
    };
    const artifactScope = args.tripLogId ?? "unlinked";
    const routeArtifactKey = `trip-logs/${artifactScope}/routes/${routeComputedAt}.json`;

    await r2.store(ctx, new TextEncoder().encode(JSON.stringify(routeArtifactPayload)), {
      key: routeArtifactKey,
      type: "application/json",
    });

    if (args.tripLogId) {
      await ctx.runMutation(internal.tripLogs.applyRouteCalculationInternal, {
        tripLogId: args.tripLogId,
        start: resolvedStart,
        stops: resolvedStops,
        radarMiles: normalizedMiles,
        finalMiles: normalizedMiles,
        mileageSource: "radar",
        mileageOverrideReason: undefined,
        routeGeoJson,
        routeArtifactKey,
        routeComputedAt,
        updatedBy: actorId,
      });
    }

    return {
      start: resolvedStart,
      stops: resolvedStops,
      radarMiles: normalizedMiles,
      finalMiles: normalizedMiles,
      mileageSource: "radar" as const,
      routeGeoJson,
      routeArtifactKey,
      routeComputedAt,
    };
  },
});

function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

export const exportMonthlyCsv = action({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  returns: v.object({
    key: v.string(),
    url: v.string(),
    rowCount: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    key: string;
    url: string;
    rowCount: number;
  }> => {
    await requireAdmin(ctx);

    const rows: Array<Record<string, string | number | boolean | undefined | null>> =
      await ctx.runQuery((internal as any).tripLogs.getExportRowsInternal, {
      fromDate: args.fromDate,
      toDate: args.toDate,
    });

    const headers = [
      "log_id",
      "status",
      "source",
      "required_for_appointment",
      "log_date",
      "business_purpose",
      "appointment_id",
      "appointment_date",
      "appointment_time",
      "customer_name",
      "start_address",
      "destinations",
      "radar_miles",
      "final_miles",
      "mileage_source",
      "mileage_override_reason",
      "expense_total_cents",
      "expense_id",
      "expense_date",
      "expense_category",
      "expense_amount_cents",
      "expense_merchant",
      "expense_notes",
      "receipt_count",
    ];

    const lines = [headers.join(",")];
    for (const row of rows) {
      const values = headers.map((header) => escapeCsvCell((row as any)[header]));
      lines.push(values.join(","));
    }

    const csvString = `${lines.join("\n")}\n`;
    const exportKey = `trip-logs/exports/${args.fromDate}_${args.toDate}_${Date.now()}.csv`;
    await r2.store(ctx, new TextEncoder().encode(csvString), {
      key: exportKey,
      type: "text/csv",
      disposition: `attachment; filename="trip-logs-${args.fromDate}-${args.toDate}.csv"`,
    });

    const url = await r2.getUrl(exportKey, { expiresIn: 60 * 60 });
    return {
      key: exportKey,
      url,
      rowCount: rows.length,
    };
  },
});

export const ensureDraftForCompletedAppointment = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  returns: v.object({
    tripLogId: v.id("tripLogs"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment || appointment.status !== "completed") {
      throw new ConvexError({
        code: "APPOINTMENT_NOT_COMPLETED",
        message: "Mileage logs can only be auto-created for completed appointments.",
      });
    }

    const existing = await ctx.db
      .query("tripLogs")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .first();
    if (existing) {
      return { tripLogId: existing._id, created: false };
    }

    const actorId = await resolveActorForSystemWrite(ctx, appointment.createdBy);
    const now = Date.now();
    const tripLogId = await ctx.db.insert("tripLogs", {
      source: "appointment",
      appointmentId: appointment._id,
      userId: appointment.userId,
      requiredForAppointment: true,
      status: "draft",
      logDate: appointment.scheduledDate,
      businessPurpose: "Completed service appointment",
      start: {},
      stops: [
        sanitizeLocation({
          addressLabel: `${appointment.location.street}, ${appointment.location.city}, ${appointment.location.state} ${appointment.location.zip}`,
          street: appointment.location.street,
          city: appointment.location.city,
          state: appointment.location.state,
          postalCode: appointment.location.zip,
        }),
      ],
      mileageSource: "radar",
      expenseTotalCents: 0,
      createdBy: actorId,
      updatedBy: actorId,
      updatedAt: now,
    });

    if (shouldScheduleNotificationJobs()) {
      await ctx.scheduler.runAfter(0, internal.notifications.queueMileageLogRequired, {
        tripLogId,
        appointmentId: appointment._id,
        transition: `${appointment.status}->mileage_log_required`,
      });
    }

    return { tripLogId, created: true };
  },
});

export const applyRouteCalculationInternal = internalMutation({
  args: {
    tripLogId: v.id("tripLogs"),
    start: locationInputValidator,
    stops: v.array(locationInputValidator),
    radarMiles: v.number(),
    finalMiles: v.number(),
    mileageSource: mileageSourceValidator,
    mileageOverrideReason: v.optional(v.string()),
    routeGeoJson: routeGeoJsonValidator,
    routeArtifactKey: v.string(),
    routeComputedAt: v.number(),
    updatedBy: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tripLog = await ctx.db.get(args.tripLogId);
    if (!tripLog || tripLog.status !== "draft") {
      return null;
    }

    await ctx.db.patch(args.tripLogId, {
      start: sanitizeLocation(args.start),
      stops: args.stops.map(sanitizeLocation),
      radarMiles: args.radarMiles,
      finalMiles: args.finalMiles,
      mileageSource: args.mileageSource,
      mileageOverrideReason: args.mileageOverrideReason,
      routeGeoJson: args.routeGeoJson,
      routeArtifactKey: args.routeArtifactKey,
      routeComputedAt: args.routeComputedAt,
      updatedAt: Date.now(),
      updatedBy: args.updatedBy,
    });

    return null;
  },
});

export const getExportRowsInternal = internalQuery({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("tripLogs")
      .withIndex("by_log_date", (q) =>
        q.gte("logDate", args.fromDate).lte("logDate", args.toDate),
      )
      .collect();

    logs.sort((a, b) => {
      if (a.logDate === b.logDate) {
        return a._creationTime - b._creationTime;
      }
      return a.logDate.localeCompare(b.logDate);
    });

    const rows: Array<Record<string, string | number | boolean | undefined | null>> = [];
    for (const log of logs) {
      const appointment = log.appointmentId ? await ctx.db.get(log.appointmentId) : null;
      const customer = appointment ? await ctx.db.get(appointment.userId) : null;
      const expenses = await ctx.db
        .query("tripLogExpenses")
        .withIndex("by_trip_log", (q) => q.eq("tripLogId", log._id))
        .collect();

      const startAddress =
        log.start.addressLabel ||
        [log.start.street, log.start.city, log.start.state, log.start.postalCode]
          .filter(Boolean)
          .join(", ");
      const destinations = log.stops
        .map(
          (stop) =>
            stop.addressLabel ||
            [stop.street, stop.city, stop.state, stop.postalCode]
              .filter(Boolean)
              .join(", "),
        )
        .filter(Boolean)
        .join(" | ");

      if (expenses.length === 0) {
        rows.push({
          log_id: log._id,
          status: log.status,
          source: log.source,
          required_for_appointment: log.requiredForAppointment,
          log_date: log.logDate,
          business_purpose: log.businessPurpose,
          appointment_id: log.appointmentId || undefined,
          appointment_date: appointment?.scheduledDate,
          appointment_time: appointment?.scheduledTime,
          customer_name: customer?.name,
          start_address: startAddress,
          destinations,
          radar_miles: log.radarMiles,
          final_miles: log.finalMiles,
          mileage_source: log.mileageSource,
          mileage_override_reason: log.mileageOverrideReason,
          expense_total_cents: log.expenseTotalCents,
          expense_id: "",
          expense_date: "",
          expense_category: "",
          expense_amount_cents: "",
          expense_merchant: "",
          expense_notes: "",
          receipt_count: 0,
        });
        continue;
      }

      for (const expense of expenses) {
        rows.push({
          log_id: log._id,
          status: log.status,
          source: log.source,
          required_for_appointment: log.requiredForAppointment,
          log_date: log.logDate,
          business_purpose: log.businessPurpose,
          appointment_id: log.appointmentId || undefined,
          appointment_date: appointment?.scheduledDate,
          appointment_time: appointment?.scheduledTime,
          customer_name: customer?.name,
          start_address: startAddress,
          destinations,
          radar_miles: log.radarMiles,
          final_miles: log.finalMiles,
          mileage_source: log.mileageSource,
          mileage_override_reason: log.mileageOverrideReason,
          expense_total_cents: log.expenseTotalCents,
          expense_id: expense._id,
          expense_date: expense.incurredDate,
          expense_category: expense.category,
          expense_amount_cents: expense.amountCents,
          expense_merchant: expense.merchant,
          expense_notes: expense.notes,
          receipt_count: expense.receipts.length,
        });
      }
    }

    return rows;
  },
});

export const backfillCompletedAppointments = internalAction({
  args: {
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
  }),
  handler: async (ctx, args) => {
    const completedAppointments = await ctx.runQuery(
      internal.tripLogs.listCompletedAppointmentsForBackfill,
      {},
    );

    let processed = 0;
    let created = 0;
    for (const appointmentId of completedAppointments) {
      const appointment = await ctx.runQuery(internal.appointments.getByIdInternal, {
        appointmentId,
      });
      if (!appointment) continue;
      if (args.fromDate && appointment.scheduledDate < args.fromDate) continue;
      if (args.toDate && appointment.scheduledDate > args.toDate) continue;

      processed += 1;
      const result = await ctx.runMutation(internal.tripLogs.ensureDraftForCompletedAppointment, {
        appointmentId,
      });
      if (result.created) {
        created += 1;
      }
    }

    return { processed, created };
  },
});

export const ensureDraftForAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  returns: v.object({
    tripLogId: v.id("tripLogs"),
    created: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ tripLogId: Id<"tripLogs">; created: boolean }> => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("tripLogs")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .first();
    if (existing) {
      return { tripLogId: existing._id, created: false };
    }

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment || appointment.status !== "completed") {
      throw new ConvexError({
        code: "APPOINTMENT_NOT_COMPLETED",
        message: "Mileage logs can only be created for completed appointments.",
      });
    }

    const result = await ctx.runMutation(internal.tripLogs.ensureDraftForCompletedAppointment, {
      appointmentId: args.appointmentId,
    });
    return result;
  },
});

export const backfillCompletedAppointmentDrafts = action({
  args: {
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ processed: number; created: number }> => {
    await requireAdmin(ctx);
    const result = await ctx.runAction(internal.tripLogs.backfillCompletedAppointments, args);
    return result;
  },
});

export const listCompletedAppointmentsForBackfill = internalQuery({
  args: {},
  returns: v.array(v.id("appointments")),
  handler: async (ctx) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();
    return appointments.map((appointment) => appointment._id);
  },
});
