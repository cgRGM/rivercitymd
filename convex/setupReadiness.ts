import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { BOOKING_BLOCK_MINUTES } from "./lib/booking";
import { isBookableStandardService } from "./lib/pricing";

const blockerCodeValidator = v.union(
  v.literal("missing_business_info"),
  v.literal("missing_availability"),
  v.literal("missing_bookable_service_pricing"),
);

const blockerValidator = v.object({
  code: blockerCodeValidator,
  message: v.string(),
  actionPath: v.string(),
});

const readinessValidator = v.object({
  isReady: v.boolean(),
  blockers: v.array(blockerValidator),
  checks: v.object({
    businessInfoConfigured: v.boolean(),
    availabilityConfigured: v.boolean(),
    bookableServicePricingConfigured: v.boolean(),
  }),
});

type BlockerCode =
  | "missing_business_info"
  | "missing_availability"
  | "missing_bookable_service_pricing";

type BookingReadiness = {
  isReady: boolean;
  blockers: Array<{
    code: BlockerCode;
    message: string;
    actionPath: string;
  }>;
  checks: {
    businessInfoConfigured: boolean;
    availabilityConfigured: boolean;
    bookableServicePricingConfigured: boolean;
  };
};

function hasValidBookableAvailabilityWindow(startTime: string, endTime: string): boolean {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return false;
  }

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end - start >= BOOKING_BLOCK_MINUTES;
}

async function evaluateBookingReadiness(ctx: { db: any }): Promise<BookingReadiness> {
  const [businessInfo, availability, services] = await Promise.all([
    ctx.db.query("businessInfo").first(),
    ctx.db
      .query("availability")
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect(),
    ctx.db.query("services").collect(),
  ]);

  const checks = {
    businessInfoConfigured: businessInfo !== null,
    availabilityConfigured: availability.some((slot: any) =>
      hasValidBookableAvailabilityWindow(slot.startTime, slot.endTime),
    ),
    bookableServicePricingConfigured: services.some((service: any) =>
      isBookableStandardService(service),
    ),
  };

  const blockers: BookingReadiness["blockers"] = [];
  if (!checks.businessInfoConfigured) {
    blockers.push({
      code: "missing_business_info",
      message: "Business information is not configured yet.",
      actionPath: "/admin/settings#business-information",
    });
  }

  if (!checks.availabilityConfigured) {
    blockers.push({
      code: "missing_availability",
      message: "Operating hours are not configured with a valid booking window.",
      actionPath: "/admin/settings#operating-hours",
    });
  }

  if (!checks.bookableServicePricingConfigured) {
    blockers.push({
      code: "missing_bookable_service_pricing",
      message:
        "At least one active standard service with positive pricing is required.",
      actionPath: "/admin/services",
    });
  }

  return {
    isReady: blockers.length === 0,
    blockers,
    checks,
  };
}

export const getBookingReadinessInternal = internalQuery({
  args: {},
  returns: readinessValidator,
  handler: async (ctx) => {
    return await evaluateBookingReadiness(ctx);
  },
});

export const getPublicBookingReadiness = query({
  args: {},
  returns: readinessValidator,
  handler: async (ctx) => {
    return await evaluateBookingReadiness(ctx);
  },
});

export const getAdminSetupReadiness = query({
  args: {},
  returns: readinessValidator,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await evaluateBookingReadiness(ctx);
  },
});
