import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.query("vehicles").collect();
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own vehicles, admins can see all
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

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
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only create vehicles for themselves, admins can create for anyone
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
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
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get all vehicles for this user (users are now clients)
    return await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const deleteVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Optional: Check if the user has permission to delete this vehicle

    await ctx.db.delete(args.id);
  },
});
