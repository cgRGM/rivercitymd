import {
  query,
  mutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity, isAdmin, requireAdmin } from "./auth";

const legacySizeValidator = v.union(
  v.literal("small"),
  v.literal("medium"),
  v.literal("large"),
);

const classificationValidator = v.object({
  source: v.union(
    v.literal("fuelEconomy"),
    v.literal("vpic"),
    v.literal("manual"),
    v.literal("fallback"),
  ),
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  rawCategory: v.optional(v.string()),
  needsAdminReview: v.boolean(),
});

async function attachVehicleType(ctx: any, vehicle: any) {
  return {
    ...vehicle,
    vehicleType: vehicle.vehicleTypeId
      ? await ctx.db.get(vehicle.vehicleTypeId)
      : null,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const vehicles = await ctx.db.query("vehicles").collect();
    return await Promise.all(vehicles.map((vehicle) => attachVehicleType(ctx, vehicle)));
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

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return await Promise.all(vehicles.map((vehicle) => attachVehicleType(ctx, vehicle)));
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
    vehicleTypeId: v.optional(v.id("vehicleTypes")),
    classification: v.optional(classificationValidator),
    size: v.optional(legacySizeValidator),
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

    let legacySize = args.size;
    if (args.vehicleTypeId) {
      const vehicleType = await ctx.db.get(args.vehicleTypeId);
      legacySize = vehicleType?.legacySize ?? legacySize;
    }

    return await ctx.db.insert("vehicles", {
      userId: args.userId,
      year: args.year,
      make: args.make,
      model: args.model,
      vehicleTypeId: args.vehicleTypeId,
      classification: args.classification,
      size: legacySize,
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
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return await Promise.all(vehicles.map((vehicle) => attachVehicleType(ctx, vehicle)));
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicles"),
    vehicleTypeId: v.optional(v.id("vehicleTypes")),
    size: v.optional(legacySizeValidator),
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
    let patch: typeof updates & {
      vehicleTypeOverrideBy?: typeof userId;
      vehicleTypeOverrideAt?: number;
      classification?: {
        source: "manual";
        confidence: "high";
        needsAdminReview: false;
      };
    } = { ...updates };

    if (updates.vehicleTypeId) {
      const vehicleType = await ctx.db.get(updates.vehicleTypeId);
      patch = {
        ...patch,
        size: vehicleType?.legacySize ?? updates.size,
      };
      if (isAdminUser) {
        patch.vehicleTypeOverrideBy = userId;
        patch.vehicleTypeOverrideAt = Date.now();
        patch.classification = {
          source: "manual",
          confidence: "high",
          needsAdminReview: false,
        };
      }
    }

    await ctx.db.patch(id, patch);
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
      vehicleTypeId: v.optional(v.id("vehicleTypes")),
      vehicleTypeOverrideBy: v.optional(v.id("users")),
      vehicleTypeOverrideAt: v.optional(v.number()),
      classification: v.optional(classificationValidator),
      size: v.optional(legacySizeValidator),
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
