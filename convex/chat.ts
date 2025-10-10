import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own messages, admins can see all
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only send messages to themselves, admins can send to anyone
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    await ctx.db.insert("chatMessages", {
      userId: args.userId,
      senderId: authUserId,
      senderType: currentUser?.role === "admin" ? "admin" : "client",
      message: args.message,
      messageType: "text",
      isRead: false,
    });
  },
});
