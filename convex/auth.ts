import { query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Initialize Stripe with environment variable
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY environment variable is not set. Please set it in your Convex environment.",
  );
}

// Initialize Stripe without explicit API version to use default
// This avoids version conflicts between local Stripe package and Convex component
const stripe = new Stripe(stripeSecretKey);

// Get the current user's role
// Role is determined by Clerk organization membership:
// - Users in an organization → admin
// - Users not in an organization → client
export const getUserRole = query({
  args: {},
  returns: v.union(
    v.object({
      type: v.union(v.literal("admin"), v.literal("client")),
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      phone: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      return null;
    }

    // Find user by email (Clerk email) or by Clerk user ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      return null;
    }

    // Use stored role as source of truth (no organization check)
    // Role is manually set in Convex dashboard
    const role = user.role || "client";

    return {
      type: role as "admin" | "client",
      userId: user._id,
      name: user.name || identity.email,
      email: user.email || identity.email,
      phone: user.phone || null,
    };
  },
});

// Get current authenticated user's info
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      userId: v.id("users"),
      email: v.union(v.string(), v.null()),
      name: v.union(v.string(), v.null()),
      phone: v.union(v.string(), v.null()),
      role: v.union(v.literal("admin"), v.literal("client")),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      return null;
    }

    // Find user by email (Clerk email) or by Clerk user ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      return null;
    }

    // Use stored role as source of truth (no organization check)
    // Role is manually set in Convex dashboard
    const role = user.role || "client";

    return {
      userId: user._id,
      email: user.email || identity.email,
      name: user.name || identity.name || null,
      phone: user.phone || null,
      role: role as "admin" | "client",
    };
  },
});

// Internal query to get user ID by email (used by actions)
export const getUserIdByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return user?._id || null;
  },
});

// Check if user is admin based on stored role in Convex
// Role is determined during onboarding based on Clerk organization membership:
// - Users in an organization → role set to "admin"
// - Users not in an organization → role set to "client"
// The stored role is the primary source of truth since identity.orgId
// is not available in Convex's getUserIdentity() response
export async function isAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !identity.email) return false;

  // Try to get user from Convex database
  if ("db" in ctx) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", identity.email!))
      .first();

    // Primary source of truth: stored role in Convex
    if (user?.role === "admin") return true;

    // Fallback: check identity.orgId if available (for future-proofing)
    if (identity.orgId) return true;

    return false;
  }

  // For actions, we can't query directly - use identity.orgId as fallback
  // or return false (actions should use queries/mutations for role checks)
  return !!identity.orgId;
}

// Require admin access - throws error if not admin
// Admin status is determined by stored role in Convex
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !identity.email) {
    throw new Error("Not authenticated");
  }

  // Try to get user from Convex database
  if ("db" in ctx) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", identity.email!))
      .first();

    // Primary source of truth: stored role in Convex
    if (user?.role === "admin") return;

    // Fallback: check identity.orgId if available
    if (identity.orgId) return;

    throw new Error("Admin access required");
  }

  // For actions, check identity.orgId as fallback
  if (!identity.orgId) {
    throw new Error("Admin access required");
  }
}

// Diagnostic query to inspect identity object (for debugging)
export const debugIdentity = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { error: "No identity" };

    // Get user from Convex to show stored role
    let storedRole = null;
    if (identity.email) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", identity.email!))
        .first();
      storedRole = user?.role || null;
    }

    // Return sanitized identity info (no sensitive data)
    return {
      email: identity.email,
      hasOrgId: !!identity.orgId,
      orgId: identity.orgId || null,
      tokenIdentifier: identity.tokenIdentifier,
      storedRole,
    };
  },
});

// Helper function to get user ID from Clerk identity
// Use this in queries, mutations, and actions
export async function getUserIdFromIdentity(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !identity.email) {
    return null;
  }

  // For queries and mutations, query directly
  if ("db" in ctx) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", identity.email!))
      .first();

    return user?._id || null;
  }

  // For actions, use an internal query
  return await ctx.runQuery(internal.auth.getUserIdByEmail, {
    email: identity.email,
  });
}

// Internal mutation to create or update user from Clerk identity
// This will be called when a user signs in for the first time
export const ensureUserFromClerk = internalMutation({
  args: {
    email: v.string(),
    name: v.union(v.string(), v.null()),
    clerkUserId: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (user) {
      // Update clerkUserId if not set
      if (!user.clerkUserId) {
        await ctx.db.patch(user._id, {
          clerkUserId: args.clerkUserId,
        });
      }
      return user._id;
    }

    // Create new user
    // Create Stripe customer for new users
    let stripeCustomerId: string | undefined;
    try {
      const customer = await stripe.customers.create({
        email: args.email,
        name: args.name || args.email,
        metadata: {
          clerkUserId: args.clerkUserId,
        },
      });
      stripeCustomerId = customer.id;
    } catch (error) {
      console.error("Failed to create Stripe customer:", error);
      // Continue with user creation even if Stripe customer creation fails
    }

    // Set default role and Stripe customer ID
    const userData: any = {
      email: args.email,
      name: args.name || args.email,
      clerkUserId: args.clerkUserId,
      role: "client",
      timesServiced: 0,
      totalSpent: 0,
      status: "active",
    };

    if (stripeCustomerId) {
      userData.stripeCustomerId = stripeCustomerId;
    }

    return await ctx.db.insert("users", userData);
  },
});
