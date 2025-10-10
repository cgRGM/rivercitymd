import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get business hours
export const getBusinessHours = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("availability")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Set business hours
export const setBusinessHours = mutation({
  args: {
    schedule: v.array(v.object({
      dayOfWeek: v.number(),
      startTime: v.string(),
      endTime: v.string(),
      isActive: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Clear existing schedule
    const existing = await ctx.db.query("availability").collect();
    await Promise.all(existing.map(item => ctx.db.delete(item._id)));

    // Add new schedule
    await Promise.all(
      args.schedule.map(day =>
        ctx.db.insert("availability", day)
      )
    );

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const blocks = await ctx.db.query("timeBlocks").collect();

    return blocks.filter(block =>
      block.date >= args.startDate &&
      block.date <= args.endDate
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
    type: v.union(v.literal("time_off"), v.literal("maintenance"), v.literal("other")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("timeBlocks", {
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      reason: args.reason,
      type: args.type,
      createdBy: userId,
    });
  },
});

// Check availability for booking
export const checkAvailability = query({
  args: {
    date: v.string(),
    startTime: v.string(),
    duration: v.number(), // in minutes
  },
  handler: async (ctx, args) => {
    // Get day of week (0 = Sunday)
    const dayOfWeek = new Date(args.date).getDay();

    // Check business hours
    const businessHours = await ctx.db
      .query("availability")
      .filter((q) =>
        q.and(
          q.eq(q.field("dayOfWeek"), dayOfWeek),
          q.eq(q.field("isActive"), true)
        )
      )
      .first();

    if (!businessHours) {
      return { available: false, reason: "Business closed on this day" };
    }

    // Check if requested time is within business hours
    const requestedStart = args.startTime;
    const requestedEndMinutes = parseInt(args.startTime.split(':')[0]) * 60 +
                               parseInt(args.startTime.split(':')[1]) +
                               args.duration;
    const requestedEnd = `${Math.floor(requestedEndMinutes / 60).toString().padStart(2, '0')}:${(requestedEndMinutes % 60).toString().padStart(2, '0')}`;

    if (requestedStart < businessHours.startTime || requestedEnd > businessHours.endTime) {
      return { available: false, reason: "Outside business hours" };
    }

    // Check for time blocks
    const timeBlocks = await ctx.db
      .query("timeBlocks")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    for (const block of timeBlocks) {
      if (requestedStart < block.endTime && requestedEnd > block.startTime) {
        return { available: false, reason: `Time blocked: ${block.reason}` };
      }
    }

    // Check for existing appointments
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_date", (q) => q.eq("scheduledDate", args.date))
      .filter((q) =>
        q.neq(q.field("status"), "cancelled")
      )
      .collect();

    for (const apt of appointments) {
      const aptEndMinutes = parseInt(apt.scheduledTime.split(':')[0]) * 60 +
                           parseInt(apt.scheduledTime.split(':')[1]) +
                           apt.duration;
      const aptEnd = `${Math.floor(aptEndMinutes / 60).toString().padStart(2, '0')}:${(aptEndMinutes % 60).toString().padStart(2, '0')}`;

      if (requestedStart < aptEnd && requestedEnd > apt.scheduledTime) {
        return { available: false, reason: "Time slot already booked" };
      }
    }

    return { available: true, reason: null };
  },
});
