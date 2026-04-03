import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity, requireAdmin } from "./auth";
import {
  addDaysToDateKey,
  BOOKING_BLOCK_MINUTES,
  getUtcDayOfWeek,
  legacyIsoDateKey,
  NEXT_BOOKABLE_DATE_HORIZON_DAYS,
  normalizeDateKey,
} from "./lib/booking";

const MAX_NEXT_BOOKABLE_HORIZON_DAYS = 60;

type SlotAvailability = {
  available: boolean;
  reason: string | null;
};

// Get business hours (all rows for admin editing)
export const getBusinessHours = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("availability").collect();
  },
});

// Set business hours
export const setBusinessHours = mutation({
  args: {
    schedule: v.array(
      v.object({
        dayOfWeek: v.number(),
        startTime: v.string(),
        endTime: v.string(),
        isActive: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Clear existing schedule
    const existing = await ctx.db.query("availability").collect();
    await Promise.all(existing.map((item) => ctx.db.delete(item._id)));

    // Add new schedule
    await Promise.all(args.schedule.map((day) => ctx.db.insert("availability", day)));

    return true;
  },
});

// Get blocked times
export const getBlockedTimes = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const blocks = await ctx.db.query("timeBlocks").collect();

    return blocks.filter(
      (block) => block.date >= args.startDate && block.date <= args.endDate,
    );
  },
});

// Add time block
export const addTimeBlock = mutation({
  args: {
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    reason: v.string(),
    type: v.union(
      v.literal("time_off"),
      v.literal("maintenance"),
      v.literal("other"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("timeBlocks", {
      date: normalizeDateKey(args.date),
      startTime: args.startTime,
      endTime: args.endTime,
      reason: args.reason,
      type: args.type,
      createdBy: userId,
    });
  },
});

export const deleteTimeBlock = mutation({
  args: {
    timeBlockId: v.id("timeBlocks"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.timeBlockId);
  },
});

async function getBusinessHoursForDate(ctx: any, dateKey: string) {
  const dayOfWeek = getUtcDayOfWeek(dateKey);

  return await ctx.db
    .query("availability")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("dayOfWeek"), dayOfWeek),
        q.eq(q.field("isActive"), true),
      ),
    )
    .first();
}

async function getTimeBlocksForDate(ctx: any, dateKey: string) {
  const [normalizedBlocks, legacyBlocks] = await Promise.all([
    ctx.db
      .query("timeBlocks")
      .withIndex("by_date", (q: any) => q.eq("date", dateKey))
      .collect(),
    ctx.db
      .query("timeBlocks")
      .withIndex("by_date", (q: any) => q.eq("date", legacyIsoDateKey(dateKey)))
      .collect(),
  ]);

  const deduped = new Map<string, any>();
  for (const block of [...normalizedBlocks, ...legacyBlocks]) {
    deduped.set(block._id, block);
  }
  return [...deduped.values()];
}

async function getAppointmentsForDate(ctx: any, dateKey: string) {
  const [normalizedAppointments, legacyAppointments] = await Promise.all([
    ctx.db
      .query("appointments")
      .withIndex("by_date", (q: any) => q.eq("scheduledDate", dateKey))
      .collect(),
    ctx.db
      .query("appointments")
      .withIndex("by_date", (q: any) =>
        q.eq("scheduledDate", legacyIsoDateKey(dateKey)),
      )
      .collect(),
  ]);

  const deduped = new Map<string, any>();
  for (const appointment of [...normalizedAppointments, ...legacyAppointments]) {
    deduped.set(appointment._id, appointment);
  }

  return [...deduped.values()].filter((appointment) => appointment.status !== "cancelled");
}

async function getActiveDraftHoldsForDate(ctx: any, dateKey: string) {
  const now = Date.now();
  const drafts = await ctx.db
    .query("bookingDrafts")
    .withIndex("by_status", (q: any) => q.eq("status", "checkout_open"))
    .collect();

  return drafts.filter(
    (draft: any) =>
      draft.scheduledDate === dateKey &&
      typeof draft.holdExpiresAt === "number" &&
      draft.holdExpiresAt > now,
  );
}

// Helper function for availability checking
async function checkSlotAvailability(
  ctx: any,
  dateInput: string,
  startTime: string,
  duration: number,
  ignoreBookingDraftId?: string,
  ignoreAppointmentId?: string,
): Promise<SlotAvailability> {
  const dateKey = normalizeDateKey(dateInput);
  const businessHours = await getBusinessHoursForDate(ctx, dateKey);

  if (!businessHours) {
    return { available: false, reason: "Business closed on this day" };
  }

  // Check if requested time is within business hours
  const requestedStart = startTime;
  const requestedEndMinutes =
    parseInt(startTime.split(":")[0], 10) * 60 +
    parseInt(startTime.split(":")[1], 10) +
    duration;
  const requestedEnd = `${Math.floor(requestedEndMinutes / 60)
    .toString()
    .padStart(2, "0")}:${(requestedEndMinutes % 60).toString().padStart(2, "0")}`;

  if (
    requestedStart < businessHours.startTime ||
    requestedEnd > businessHours.endTime
  ) {
    return { available: false, reason: "Outside business hours" };
  }

  // Check for time blocks
  const timeBlocks = await getTimeBlocksForDate(ctx, dateKey);
  for (const block of timeBlocks) {
    if (requestedStart < block.endTime && requestedEnd > block.startTime) {
      return { available: false, reason: `Blocked: ${block.reason}` };
    }
  }

  // Check for existing appointments
  const appointments = await getAppointmentsForDate(ctx, dateKey);
  for (const appointment of appointments) {
    if (ignoreAppointmentId && appointment._id === ignoreAppointmentId) {
      continue;
    }

    const occupiedDuration = Math.max(
      appointment.duration || 0,
      BOOKING_BLOCK_MINUTES,
    );
    const appointmentEndMinutes =
      parseInt(appointment.scheduledTime.split(":")[0], 10) * 60 +
      parseInt(appointment.scheduledTime.split(":")[1], 10) +
      occupiedDuration;
    const appointmentEnd = `${Math.floor(appointmentEndMinutes / 60)
      .toString()
      .padStart(2, "0")}:${(appointmentEndMinutes % 60)
      .toString()
      .padStart(2, "0")}`;

    if (requestedStart < appointmentEnd && requestedEnd > appointment.scheduledTime) {
      return { available: false, reason: "Time slot already booked" };
    }
  }

  const draftHolds = await getActiveDraftHoldsForDate(ctx, dateKey);
  for (const draft of draftHolds) {
    if (ignoreBookingDraftId && draft._id === ignoreBookingDraftId) {
      continue;
    }

    const occupiedDuration = Math.max(draft.duration || 0, BOOKING_BLOCK_MINUTES);
    const draftEndMinutes =
      parseInt(draft.scheduledTime.split(":")[0], 10) * 60 +
      parseInt(draft.scheduledTime.split(":")[1], 10) +
      occupiedDuration;
    const draftEnd = `${Math.floor(draftEndMinutes / 60)
      .toString()
      .padStart(2, "0")}:${(draftEndMinutes % 60).toString().padStart(2, "0")}`;

    if (requestedStart < draftEnd && requestedEnd > draft.scheduledTime) {
      return { available: false, reason: "Time slot is being held during checkout" };
    }
  }

  return { available: true, reason: null };
}

function isDateKeyToday(dateKey: string): boolean {
  const todayKey = new Date().toISOString().split("T")[0];
  return dateKey === todayKey;
}

function isFutureSlotForToday(dateKey: string, time: string): boolean {
  if (!isDateKeyToday(dateKey)) {
    return true;
  }

  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  const slot = new Date(now);
  slot.setHours(hours, minutes, 0, 0);
  return slot > now;
}

async function hasAtLeastOneBookableSlotForDate(ctx: any, dateKey: string) {
  const businessHours = await getBusinessHoursForDate(ctx, dateKey);
  if (!businessHours) {
    return false;
  }

  const startMinutes = timeToMinutes(businessHours.startTime);
  const endMinutes = timeToMinutes(businessHours.endTime);

  for (
    let minutes = startMinutes;
    minutes + BOOKING_BLOCK_MINUTES <= endMinutes;
    minutes += 15
  ) {
    const slotTime = minutesToTime(minutes);
    if (!isFutureSlotForToday(dateKey, slotTime)) {
      continue;
    }

    const availability = await checkSlotAvailability(
      ctx,
      dateKey,
      slotTime,
      BOOKING_BLOCK_MINUTES,
    );
    if (availability.available) {
      return true;
    }
  }

  return false;
}

// Check availability for booking
export const checkAvailability = query({
  args: {
    date: v.string(),
    startTime: v.string(),
    duration: v.number(), // in minutes
    ignoreBookingDraftId: v.optional(v.id("bookingDrafts")),
    ignoreAppointmentId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, args) => {
    return await checkSlotAvailability(
      ctx,
      args.date,
      args.startTime,
      args.duration,
      args.ignoreBookingDraftId,
      args.ignoreAppointmentId,
    );
  },
});

// Get available time slots for a specific date
export const getAvailableTimeSlots = query({
  args: {
    date: v.string(),
    serviceDuration: v.number(), // retained for API compatibility
    ignoreAppointmentId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, args) => {
    if (!args.date) {
      return [];
    }

    const dateKey = normalizeDateKey(args.date);
    const businessHours = await getBusinessHoursForDate(ctx, dateKey);

    if (!businessHours) {
      return []; // No business hours for this day
    }

    // Generate time slots in 15-minute intervals
    const slots = [];
    const startMinutes = timeToMinutes(businessHours.startTime);
    const endMinutes = timeToMinutes(businessHours.endTime);

    // Only generate start times where start + blockDuration <= business close
    for (
      let minutes = startMinutes;
      minutes + BOOKING_BLOCK_MINUTES <= endMinutes;
      minutes += 15
    ) {
      const timeString = minutesToTime(minutes);

      // Check if this slot is available
      const availability = await checkSlotAvailability(
        ctx,
        dateKey,
        timeString,
        BOOKING_BLOCK_MINUTES,
        undefined,
        args.ignoreAppointmentId,
      );

      slots.push({
        time: timeString,
        displayTime: formatDisplayTime(timeString),
        available: availability.available,
        reason: availability.reason,
      });
    }

    return slots;
  },
});

export const getNextBookableDate = query({
  args: {
    fromDate: v.optional(v.string()),
    horizonDays: v.optional(v.number()),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const startDateKey = normalizeDateKey(args.fromDate ?? new Date().toISOString());
    const requestedHorizon = args.horizonDays ?? NEXT_BOOKABLE_DATE_HORIZON_DAYS;
    const horizonDays = Math.min(
      MAX_NEXT_BOOKABLE_HORIZON_DAYS,
      Math.max(1, Math.floor(requestedHorizon)),
    );

    for (let offset = 0; offset < horizonDays; offset += 1) {
      const candidateDate = addDaysToDateKey(startDateKey, offset);
      const hasBookableSlot = await hasAtLeastOneBookableSlotForDate(
        ctx,
        candidateDate,
      );
      if (hasBookableSlot) {
        return candidateDate;
      }
    }

    return null;
  },
});

// Helper function to convert HH:MM to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to convert minutes to HH:MM
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Helper function to format time for display
function formatDisplayTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}
