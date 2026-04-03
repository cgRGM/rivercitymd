import {
  query,
  mutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity, isAdmin, requireAdmin } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("vehicles").collect();
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await getUserIdFromIdentity(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own vehicles, admins can see all
    const isAdminUser = await isAdmin(ctx);
    if (!isAdminUser && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Internal query to get vehicles by user (for use by internal actions)
export const listByUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    year: v.number(),
    make: v.string(),
    model: v.string(),
    size: v.optional(
      v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
    ),
    color: v.optional(v.string()),
    licensePlate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUserId = await getUserIdFromIdentity(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only create vehicles for themselves, admins can create for anyone
    const isAdminUser = await isAdmin(ctx);
    if (!isAdminUser && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db.insert("vehicles", {
      userId: args.userId,
      year: args.year,
      make: args.make,
      model: args.model,
      size: args.size,
      color: args.color,
      licensePlate: args.licensePlate,
      notes: args.notes,
    });
  },
});

export const getMyVehicles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) return [];

    // Get all vehicles for this user (users are now clients)
    return await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicles"),
    size: v.optional(
      v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
    ),
    color: v.optional(v.string()),
    licensePlate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) throw new Error("Vehicle not found");
    const isAdminUser = await isAdmin(ctx);
    if (!isAdminUser && vehicle.userId !== userId) {
      throw new Error("Access denied");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deleteVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) throw new Error("Vehicle not found");
    const isAdminUser = await isAdmin(ctx);
    if (!isAdminUser && vehicle.userId !== userId) {
      throw new Error("Access denied");
    }

    const [appointments, subscriptions, bookingDrafts] = await Promise.all([
      ctx.db.query("appointments").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("bookingDrafts").collect(),
    ]);

    const linkedAppointment = appointments.find((appointment) =>
      appointment.vehicleIds.includes(args.id),
    );
    if (linkedAppointment) {
      throw new Error(
        "This vehicle is attached to an appointment and cannot be deleted.",
      );
    }

    const linkedSubscription = subscriptions.find((subscription) =>
      subscription.vehicleIds.includes(args.id),
    );
    if (linkedSubscription) {
      throw new Error(
        "This vehicle is attached to a subscription and cannot be deleted.",
      );
    }

    const linkedDraft = bookingDrafts.find(
      (draft) =>
        draft.existingVehicleIds.includes(args.id) &&
        draft.status !== "converted" &&
        draft.status !== "cancelled" &&
        draft.status !== "expired",
    );
    if (linkedDraft) {
      throw new Error(
        "This vehicle is attached to an in-progress booking and cannot be deleted.",
      );
    }

    await ctx.db.delete(args.id);
  },
});

// Internal query to get vehicle by ID (for use by internal actions)
export const getByIdInternal = internalQuery({
  args: { vehicleId: v.id("vehicles") },
  returns: v.union(
    v.object({
      _id: v.id("vehicles"),
      _creationTime: v.number(),
      userId: v.id("users"),
      year: v.number(),
      make: v.string(),
      model: v.string(),
      size: v.optional(
        v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
      ),
      color: v.optional(v.string()),
      licensePlate: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.vehicleId);
  },
});
