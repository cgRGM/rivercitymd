import { query } from "./_generated/server";
import { v } from "convex/values";

export const dumpUsers = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

export const dumpAppointments = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
      
    if (!user) return [];

    return await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});
export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter(u => 
      (u.name && u.name.toLowerCase().includes(args.query.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(args.query.toLowerCase()))
    );
  },
});
