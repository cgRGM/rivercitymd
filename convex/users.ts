import {
  query,
  mutation,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getUserIdFromIdentity, requireAdmin, isAdmin } from "./auth";

const DEFAULT_USER_NOTIFICATION_PREFERENCES = {
  emailNotifications: true,
  smsNotifications: true,
  marketingEmails: false,
  serviceReminders: true,
  events: {
    appointmentConfirmed: true,
    appointmentCancelled: true,
    appointmentRescheduled: true,
    appointmentStarted: true,
    appointmentCompleted: true,
  },
} as const;

const STRIPE_CUSTOMER_SYNC_RETRY_DELAYS_MS = [
  0,
  60_000,
  300_000,
  1_800_000,
  7_200_000,
] as const;
const DEFAULT_STRIPE_BACKFILL_LIMIT = 200;
const MAX_STRIPE_BACKFILL_LIMIT = 1000;

function resolvePreferredName(args: {
  onboardingName?: string;
  existingName?: string;
  identityName?: string;
  identityEmail?: string;
}): string {
  const onboardingName = args.onboardingName?.trim();
  if (onboardingName) return onboardingName;

  const existingName = args.existingName?.trim();
  if (existingName) return existingName;

  const identityName = args.identityName?.trim();
  if (identityName) return identityName;

  const identityEmail = args.identityEmail?.trim();
  if (identityEmail) return identityEmail;

  return "User";
}

function shouldScheduleNotificationJobs(): boolean {
  return process.env.CONVEX_TEST !== "true" && process.env.NODE_ENV !== "test";
}

function normalizeBackfillLimit(limit?: number): number {
  if (limit === undefined) {
    return DEFAULT_STRIPE_BACKFILL_LIMIT;
  }
  return Math.min(MAX_STRIPE_BACKFILL_LIMIT, Math.max(1, Math.floor(limit)));
}

// Get count of new customers (created in last 30 days, admin only)
export const getNewCustomersCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const users = await ctx.db.query("users").collect();

    // Filter for customers (not admins) created in last 30 days
    // Admin status is determined by stored role field
    const newCustomers = users.filter((user) => {
      return user.role !== "admin" && user._creationTime >= thirtyDaysAgo;
    });

    return newCustomers.length;
  },
});

// Get all users (admin only)
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return await ctx.db.query("users").collect();
  },
});

// Get user by ID
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await getUserIdFromIdentity(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own data, admins can see all
    const isAdminUser = await isAdmin(ctx);
    if (!isAdminUser && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db.get(args.userId);
  },
});

// Get the current user's profile
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.db.get(userId);
  },
});

// Internal query to get user by ID (no auth required, for internal actions)
export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Doc<"users"> | null> => {
    return await ctx.db.get(args.userId);
  },
});

// Check if user has completed onboarding (has address and at least one vehicle)
export const hasCompletedOnboarding = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) {
      return false;
    }

    const user = await ctx.db.get(userId);
    if (!user) return false;

    // Check if user has address and at least one vehicle
    const hasAddress = !!user.address;
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const hasVehicles = vehicles.length > 0;

    return hasAddress && hasVehicles;
  },
});

// Get detailed onboarding status (which steps are missing)
export const getOnboardingStatus = query({
  args: {},
  returns: v.object({
    isComplete: v.boolean(),
    missingSteps: v.array(v.string()),
    nextStep: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) {
      return {
        isComplete: false,
        missingSteps: ["personal", "address", "vehicles"],
        nextStep: 1,
      };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        isComplete: false,
        missingSteps: ["personal", "address", "vehicles"],
        nextStep: 1,
      };
    }

    const missingSteps: string[] = [];
    let nextStep = 1;

    // Check personal info (name and phone are required)
    const hasPersonal = !!(user.name && user.phone);
    if (!hasPersonal) {
      missingSteps.push("personal");
      nextStep = 1;
    }

    // Check address
    const hasAddress = !!user.address;
    if (!hasAddress) {
      missingSteps.push("address");
      if (nextStep === 1 && hasPersonal) {
        nextStep = 2;
      }
    }

    // Check vehicles
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const hasVehicles = vehicles.length > 0;
    if (!hasVehicles) {
      missingSteps.push("vehicles");
      if (nextStep === 1 && hasPersonal && hasAddress) {
        nextStep = 3;
      }
    }

    return {
      isComplete: missingSteps.length === 0,
      missingSteps,
      nextStep,
    };
  },
});

// Get user's vehicles
export const getUserVehicles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Create new user (admin only)
export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("client"))),
    address: v.optional(
      v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        zip: v.string(),
      }),
    ),
    notes: v.optional(v.string()),
    // Vehicle fields
    year: v.optional(v.number()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      phone: args.phone,
      role: args.role || "client",
      address: args.address,
      timesServiced: 0,
      totalSpent: 0,
      status: "active",
      cancellationCount: 0,
      notes: args.notes,
      notificationPreferences: DEFAULT_USER_NOTIFICATION_PREFERENCES,
    });

    if (args.year && args.make && args.model) {
      await ctx.db.insert("vehicles", {
        userId,
        year: args.year,
        make: args.make,
        model: args.model,
        color: args.color,
      });
    }

    return userId;
  },
});

// Create user profile during onboarding
export const createUserProfile = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    address: v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
    }),
    vehicles: v.array(
      v.object({
        year: v.number(),
        make: v.string(),
        model: v.string(),
        color: v.string(),
      }),
    ),
  },
  returns: v.object({
    userId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.subject) {
      throw new Error("Not authenticated");
    }

    // Get Clerk user ID from identity (needed for user creation and updates)
    const clerkUserId = identity.subject;

    // Check if user exists, create if not
    let userId = await getUserIdFromIdentity(ctx);

    if (!userId) {
      // User doesn't exist - create them first

      // Check if user exists by clerkUserId (in case they were created manually)
      // This preserves admin roles if an admin was created in Clerk but not in Convex
      const existingUserByClerkId = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
        .first();

      if (existingUserByClerkId) {
        // User exists by clerkUserId - use existing user and preserve their role
        userId = existingUserByClerkId._id;
      } else {
        // User doesn't exist at all - create new user
        // Default to client role (admin must be set manually in Convex dashboard)
        const userRole = "client"; // Always default to client for new users
        const resolvedName = resolvePreferredName({
          onboardingName: args.name,
          identityName: identity.name,
          identityEmail: identity.email,
        });

        // Create new user with role (Stripe customer sync runs after onboarding completion)
        const userData: any = {
          name: resolvedName,
          clerkUserId: clerkUserId,
          role: userRole, // Always "client" for new users
          timesServiced: 0,
          totalSpent: 0,
          status: "active",
          notificationPreferences: DEFAULT_USER_NOTIFICATION_PREFERENCES,
          // stripeCustomerId will be set by onboarding/payment Stripe sync flows
        };
        if (identity.email) {
          userData.email = identity.email;
        }

        userId = await ctx.db.insert("users", userData);
      }
    }

    // Get existing user to check if onboarding is already complete (idempotent check)
    const existingUser = await ctx.db.get(userId);
    const hasExistingAddress = !!existingUser?.address;
    const existingVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const hasExistingVehicles = existingVehicles.length > 0;

    // If user already has onboarding data (address and vehicles), don't overwrite
    // This makes the mutation idempotent and prevents data loss
    if (hasExistingAddress && hasExistingVehicles) {
      // Onboarding already complete - preserve existing role, don't overwrite
      // Only update role if it's currently undefined
      if (existingUser.role === undefined) {
        // Default to client if no role set
        await ctx.db.patch(userId, {
          role: "client",
          notificationPreferences:
            existingUser.notificationPreferences ||
            DEFAULT_USER_NOTIFICATION_PREFERENCES,
        });
      }
      if (!existingUser.stripeCustomerId) {
        await ctx.scheduler.runAfter(
          0,
          internal.users.ensureStripeCustomerWithRetry,
          {
            userId,
            attempt: 0,
          },
        );
      }
      // If role is already set (including "admin"), preserve it
      return { userId };
    }

    // Update user with onboarding data
    // IMPORTANT: Preserve existing admin role, only set if undefined
    const shouldPreserveAdminRole = existingUser?.role === "admin";
    const userRole = shouldPreserveAdminRole
      ? "admin"
      : existingUser?.role || "client";
    const resolvedName = resolvePreferredName({
      onboardingName: args.name,
      existingName: existingUser?.name,
      identityName: identity.name,
      identityEmail: identity.email,
    });

    await ctx.db.patch(userId, {
      name: resolvedName,
      phone: args.phone,
      address: args.address,
      clerkUserId: clerkUserId, // Ensure clerkUserId is set
      role: userRole, // Preserve admin, default to client for new users
      timesServiced: 0,
      totalSpent: 0,
      status: "active",
      notificationPreferences:
        existingUser?.notificationPreferences ||
        DEFAULT_USER_NOTIFICATION_PREFERENCES,
    });

    // Only create vehicles if they don't already exist (idempotent)
    // Delete existing vehicles first if we're re-running onboarding
    if (hasExistingVehicles) {
      for (const vehicle of existingVehicles) {
        await ctx.db.delete(vehicle._id);
      }
    }

    // Create vehicles
    for (const vehicle of args.vehicles) {
      await ctx.db.insert("vehicles", {
        userId,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
      });
    }

    // Sync Stripe customer as soon as onboarding is complete.
    // Retries are handled internally if Stripe is temporarily unavailable.
    await ctx.scheduler.runAfter(0, internal.users.ensureStripeCustomerWithRetry, {
      userId,
      attempt: 0,
    });

    // Send admin notification email for new customer (after onboarding complete)
    // Only send if this is a new user (not updating existing)
    if (!hasExistingAddress || !hasExistingVehicles) {
      if (shouldScheduleNotificationJobs()) {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.queueNewCustomerOnboarded,
          {
            userId,
          },
        );
      }
      await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
        userId,
      });
    }

    return { userId };
  },
});

// ===== Clerk Webhook Handlers =====
// These mutations are called by the Clerk webhook endpoint to sync user data

// Upsert user from Clerk webhook (user.created or user.updated events)
export const upsertFromClerk = internalMutation({
  args: {
    data: v.any(), // Clerk UserJSON type - validated by webhook signature
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const clerkData = args.data as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email_addresses: Array<{ email_address: string }>;
      image_url: string | null;
    };

    const clerkUserId = clerkData.id;
    const email = clerkData.email_addresses?.[0]?.email_address || null;
    const name =
      clerkData.first_name || clerkData.last_name
        ? `${clerkData.first_name || ""} ${clerkData.last_name || ""}`.trim()
        : email || "User";

    if (!email) {
      console.warn("Clerk webhook: User has no email, skipping", clerkUserId);
      return null;
    }

    // Check if user exists by clerkUserId
    const existingUserByClerkId = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    // Also check by email in case clerkUserId wasn't set
    const existingUserByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUserByClerkId || existingUserByEmail) {
      // User exists - update basic info but preserve ALL existing data
      const userId = existingUserByClerkId?._id || existingUserByEmail!._id;
      const existingUser = await ctx.db.get(userId);

      // Update only basic user data from Clerk (name, email, image, clerkUserId)
      // IMPORTANT: Preserve ALL other fields including role, address, phone, vehicles, etc.
      // Role is manually managed in Convex dashboard - webhook never touches it
      await ctx.db.patch(userId, {
        email: email,
        name: name,
        clerkUserId: clerkUserId, // Ensure clerkUserId is set
        image: clerkData.image_url || existingUser?.image || undefined,
        // DO NOT update: role, address, phone, vehicles, stripeCustomerId, status, etc.
        // These are managed separately and should never be overwritten by webhook
      });

      return userId;
    }

    // New user - create with default values
    // Don't create Stripe customer here; onboarding completion triggers sync and
    // payment flows still have a lazy fallback.
    // Role defaults to "client" - admin role must be set manually in Convex dashboard
    const userId = await ctx.db.insert("users", {
      email: email,
      name: name,
      clerkUserId: clerkUserId,
      image: clerkData.image_url || undefined,
      role: "client", // Default role for new users - admin must be set manually in Convex dashboard
      timesServiced: 0,
      totalSpent: 0,
      status: "active",
      notificationPreferences: DEFAULT_USER_NOTIFICATION_PREFERENCES,
    });

    return userId;
  },
});

// Admin-triggered one-time backfill for active client users missing Stripe IDs.
export const backfillMissingStripeCustomers = mutation({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    scanned: v.number(),
    eligible: v.number(),
    scheduled: v.number(),
    dryRun: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const dryRun = args.dryRun ?? false;
    const limit = normalizeBackfillLimit(args.limit);
    const users = await ctx.db.query("users").collect();

    const eligibleUsers = users.filter(
      (user) =>
        user.role !== "admin" &&
        user.status !== "inactive" &&
        !user.stripeCustomerId,
    );

    if (dryRun) {
      return {
        scanned: users.length,
        eligible: eligibleUsers.length,
        scheduled: 0,
        dryRun: true,
      };
    }

    const usersToSchedule = eligibleUsers.slice(0, limit);
    for (const user of usersToSchedule) {
      await ctx.scheduler.runAfter(0, internal.users.ensureStripeCustomerWithRetry, {
        userId: user._id,
        attempt: 0,
      });
    }

    return {
      scanned: users.length,
      eligible: eligibleUsers.length,
      scheduled: usersToSchedule.length,
      dryRun: false,
    };
  },
});

// Delete user from Clerk webhook (user.deleted event)
export const deleteFromClerk = internalMutation({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) =>
        q.eq("clerkUserId", args.clerkUserId),
      )
      .first();

    if (!user) {
      console.warn(
        `Clerk webhook: Can't delete user, none found for Clerk ID: ${args.clerkUserId}`,
      );
      return null;
    }

    // Delete all vehicles associated with this user
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const vehicle of vehicles) {
      await ctx.db.delete(vehicle._id);
    }

    // Delete the user
    await ctx.db.delete(user._id);

    return user._id;
  },
});

// Update user
export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("client"))),
    address: v.optional(
      v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        zip: v.string(),
      }),
    ),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const authUserId = await getUserIdFromIdentity(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    const isAdminUser = await isAdmin(ctx);
    const isOwnProfile = authUserId === args.userId;

    // Users can update their own profile, admins can update any profile
    if (!isAdminUser && !isOwnProfile) {
      throw new Error("Access denied");
    }

    const { userId, ...updates } = args;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.role !== undefined && isAdminUser)
      updateData.role = updates.role;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined && isAdminUser)
      updateData.status = updates.status;

    await ctx.db.patch(userId, updateData);
    return userId;
  },
});

// Update user profile (for current user)
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(
      v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        zip: v.string(),
      }),
    ),
    notificationPreferences: v.optional(
      v.object({
        emailNotifications: v.boolean(),
        smsNotifications: v.boolean(),
        marketingEmails: v.boolean(),
        serviceReminders: v.boolean(),
        events: v.object({
          appointmentConfirmed: v.boolean(),
          appointmentCancelled: v.boolean(),
          appointmentRescheduled: v.boolean(),
          appointmentStarted: v.boolean(),
          appointmentCompleted: v.boolean(),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.address !== undefined) updates.address = args.address;
    if (args.notificationPreferences !== undefined) {
      updates.notificationPreferences = args.notificationPreferences;
    }

    await ctx.db.patch(userId, updates);
    return { success: true };
  },
});

// Add a vehicle to user's profile
export const addVehicle = mutation({
  args: {
    year: v.number(),
    make: v.string(),
    model: v.string(),
    color: v.string(),
    licensePlate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const vehicleId = await ctx.db.insert("vehicles", {
      userId,
      year: args.year,
      make: args.make,
      model: args.model,
      color: args.color,
      licensePlate: args.licensePlate,
      notes: args.notes,
    });

    return vehicleId;
  },
});

// Remove a vehicle
export const removeVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    if (vehicle.userId !== userId) {
      const isAdminUser = await isAdmin(ctx);
      if (!isAdminUser) {
        throw new Error("Access denied");
      }
    }

    await ctx.db.delete(args.vehicleId);
    return { success: true };
  },
});

// Delete a user and all their associated data (admin only)
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Delete associated vehicles
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const vehicle of vehicles) {
      await ctx.db.delete(vehicle._id);
    }

    // Delete associated appointments and their invoices (if not paid)
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const appointment of appointments) {
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_appointment", (q) =>
          q.eq("appointmentId", appointment._id),
        )
        .unique();
      if (invoice && invoice.status !== "paid") {
        await ctx.db.delete(invoice._id);
      }
      await ctx.db.delete(appointment._id);
    }

    // Delete the user
    await ctx.db.delete(args.userId);
  },
});

// Get user by ID with full details (appointments, invoices, vehicles) - admin only
export const getByIdWithDetails = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      user: v.any(), // Full user document
      appointments: v.array(v.any()),
      invoices: v.array(v.any()),
      vehicles: v.array(v.any()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Get all appointments for this user
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Enrich appointments with services and vehicles
    const enrichedAppointments = await Promise.all(
      appointments.map(async (apt) => {
        const services = await Promise.all(
          apt.serviceIds.map((id) => ctx.db.get(id)),
        );
        const vehicles = await Promise.all(
          apt.vehicleIds.map((id) => ctx.db.get(id)),
        );
        return {
          ...apt,
          services: services.filter((s) => s !== null),
          vehicles: vehicles.filter((v) => v !== null),
        };
      }),
    );

    // Get all invoices for this user
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get all vehicles for this user
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      user,
      appointments: enrichedAppointments,
      invoices,
      vehicles,
    };
  },
});

// Get users with statistics (total bookings, last visit, etc.) - admin only
export const listWithStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    // Filter out admin users from customer list
    // Note: This filter uses stored role, but actual admin status comes from Clerk org membership
    const clientUsers = users.filter((user) => user.role !== "admin");

    const usersWithStats = await Promise.all(
      clientUsers.map(async (user) => {
        const appointments = await ctx.db
          .query("appointments")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        const completedApts = appointments.filter(
          (a) => a.status === "completed",
        );
        const lastVisit = completedApts.sort((a, b) =>
          b.scheduledDate.localeCompare(a.scheduledDate),
        )[0];

        return {
          ...user,
          totalBookings: user.timesServiced || 0,
          totalSpent: user.totalSpent || 0,
          lastVisit: lastVisit?.scheduledDate || null,
          location: user.address
            ? `${user.address.city}, ${user.address.state}`
            : "No address",
        };
      }),
    );

    return usersWithStats.sort((a, b) =>
      (b.name || "").localeCompare(a.name || ""),
    );
  },
});

// Create user account with appointment (for marketing site signups)
// Note: Password should be handled via Convex Auth signup before calling this mutation
// This mutation creates the user in the database and appointment, but auth credentials
// must be created separately using the auth system
export const createUserWithAppointment = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    address: v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
    }),
    vehicles: v.array(
      v.object({
        year: v.number(),
        make: v.string(),
        model: v.string(),
        size: v.optional(
          v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
        ),
        color: v.optional(v.string()),
        licensePlate: v.optional(v.string()),
      }),
    ),
    serviceIds: v.array(v.id("services")),
    scheduledDate: v.string(),
    scheduledTime: v.string(),
    locationNotes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    userId: Id<"users">;
    appointmentId: Id<"appointments">;
    invoiceId: Id<"invoices">;
  }> => {
    // Check if user already exists (may have been created by auth system)
    let existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    let userId: Id<"users">;
    if (existingUser) {
      // User exists (likely created by auth system), use existing user
      userId = existingUser._id;
      // Update user info if needed (phone, address may not be set by auth)
      const updateData: any = {};
      if (!existingUser.phone) updateData.phone = args.phone;
      if (!existingUser.address) updateData.address = args.address;
      if (!existingUser.name || existingUser.name === existingUser.email) {
        updateData.name = args.name;
      }
      if (Object.keys(updateData).length > 0) {
        await ctx.db.patch(userId, updateData);
      }
    } else {
      // Create the user account (auth may have failed, so create user without password)
      userId = await ctx.db.insert("users", {
        name: args.name,
        email: args.email,
        phone: args.phone,
        address: args.address,
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
        cancellationCount: 0,
        notificationPreferences: DEFAULT_USER_NOTIFICATION_PREFERENCES,
      });
    }

    // Create vehicles
    const vehicleIds: string[] = [];
    for (const vehicle of args.vehicles) {
      const vehicleId = await ctx.db.insert("vehicles", {
        userId,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        size: vehicle.size,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
      });
      vehicleIds.push(vehicleId);
    }

    // Calculate appointment details
    const services = await Promise.all(
      args.serviceIds.map((id) => ctx.db.get(id)),
    );
    const validServices = services.filter((s) => s !== null);

    // Calculate total price using size-based pricing
    const totalPrice =
      validServices.reduce((sum, service) => {
        // Get the price based on the first vehicle's size (assuming all vehicles are the same type)
        const vehicleSize = args.vehicles[0]?.size || "medium";
        let price = service!.basePriceMedium || service!.basePrice || 0; // fallback to medium or basePrice

        if (vehicleSize === "small") {
          price =
            service!.basePriceSmall ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        } else if (vehicleSize === "large") {
          price =
            service!.basePriceLarge ||
            service!.basePriceMedium ||
            service!.basePrice ||
            0;
        }

        return sum + price;
      }, 0) * vehicleIds.length;

    const duration = validServices.reduce(
      (sum, service) => sum + (service!.duration || 0),
      0,
    );

    // Create appointment
    const appointmentId = await ctx.db.insert("appointments", {
      userId,
      vehicleIds: vehicleIds as any,
      serviceIds: args.serviceIds,
      scheduledDate: args.scheduledDate,
      scheduledTime: args.scheduledTime,
      duration,
      location: {
        street: args.address.street,
        city: args.address.city,
        state: args.address.state,
        zip: args.address.zip,
        notes: args.locationNotes,
      },
      status: "pending",
      totalPrice,
      notes: "Created via marketing site booking",
      createdBy: userId,
    });

    // Calculate invoice items
    const vehicleSize = args.vehicles[0]?.size || "medium";
    const items = validServices.map((service) => {
      // Calculate the correct price based on vehicle size
      let unitPrice = service!.basePriceMedium || service!.basePrice || 0;
      if (vehicleSize === "small") {
        unitPrice =
          service!.basePriceSmall ||
          service!.basePriceMedium ||
          service!.basePrice ||
          0;
      } else if (vehicleSize === "large") {
        unitPrice =
          service!.basePriceLarge ||
          service!.basePriceMedium ||
          service!.basePrice ||
          0;
      }

      return {
        serviceId: service!._id,
        serviceName: service!.name,
        quantity: vehicleIds.length,
        unitPrice,
        totalPrice: unitPrice * vehicleIds.length,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = 0;
    const total = subtotal + tax;

    // Get deposit amount from settings (default $50 per vehicle)
    const depositSettings = await ctx.runQuery(api.depositSettings.get, {});
    const depositPerVehicle = depositSettings?.amountPerVehicle ?? 50;
    const calculatedDepositAmount = depositPerVehicle * vehicleIds.length;
    // Cap deposit at total to prevent negative remaining balance
    const depositAmount = Math.min(calculatedDepositAmount, total);
    const remainingBalance = Math.max(0, total - depositAmount);

    // Generate invoice number
    const invoiceCount: number = (await ctx.runQuery(api.invoices.getCount, {}))
      .count;
    const invoiceNumber: string = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;

    // Create invoice date
    const appointmentDate = new Date(args.scheduledDate);
    const dueDate = new Date(appointmentDate);
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice in Convex immediately (don't create Stripe invoice yet - wait for deposit)
    const invoiceId: Id<"invoices"> = await ctx.db.insert("invoices", {
      appointmentId,
      userId,
      invoiceNumber,
      items,
      subtotal,
      tax,
      total,
      status: "draft", // Start as draft, will be sent after deposit is paid
      dueDate: dueDate.toISOString().split("T")[0],
      notes: `Invoice for appointment on ${args.scheduledDate}`,
      depositAmount,
      depositPaid: false,
      remainingBalance,
    });

    // Ensure Stripe customer exists (schedule action to create if needed)
    // This is critical for deposit checkout to work
    await ctx.scheduler.runAfter(0, internal.users.ensureStripeCustomer, {
      userId,
    });

    return { userId, appointmentId, invoiceId };
  },
});

// Update user Stripe customer ID
export const updateStripeCustomerId = mutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

async function ensureStripeCustomerForUser(
  ctx: any,
  userId: Id<"users">,
): Promise<string> {
  const user = await ctx.runQuery(internal.users.getByIdInternal, {
    userId,
  });
  if (!user) throw new Error("User not found");

  // If user already has Stripe customer ID, return it
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Avoid Stripe network calls in tests to prevent pending fetch warnings
  if (process.env.CONVEX_TEST === "true" || process.env.NODE_ENV === "test") {
    const mockCustomerId = `cus_test_${userId}`;
    await ctx.runMutation(internal.users.updateStripeCustomerIdInternal, {
      userId,
      stripeCustomerId: mockCustomerId,
    });
    return mockCustomerId;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is not set; cannot create Stripe customer",
    );
  }

  // Use Stripe component to get or create customer
  // Component's userId should be the auth provider's user ID (Clerk subject)
  // We use clerkUserId if available, otherwise fall back to Convex userId as string
  const { stripeClient } = await import("./stripeClient");
  const authUserId = user.clerkUserId || userId;
  const customer = await stripeClient.getOrCreateCustomer(ctx, {
    userId: authUserId, // Component expects auth provider's user ID (string)
    email: user.email,
    name: user.name,
    // Note: Component doesn't support metadata in getOrCreateCustomer
    // Customer metadata can be updated separately if needed via Stripe API
  });

  // Update user with Stripe customer ID
  await ctx.runMutation(internal.users.updateStripeCustomerIdInternal, {
    userId,
    stripeCustomerId: customer.customerId,
  });

  return customer.customerId;
}

// Internal action to ensure Stripe customer exists (for use by mutations)
// Now uses the @convex-dev/stripe component for customer management
export const ensureStripeCustomer = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.string(), // Returns stripeCustomerId
  handler: async (ctx, args): Promise<string> => {
    return await ensureStripeCustomerForUser(ctx, args.userId);
  },
});

// Wrapper that retries Stripe customer sync with bounded backoff.
// This action intentionally does not throw so caller flows (e.g. onboarding) remain non-blocking.
export const ensureStripeCustomerWithRetry = internalAction({
  args: {
    userId: v.id("users"),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const maxAttempt = STRIPE_CUSTOMER_SYNC_RETRY_DELAYS_MS.length - 1;
    const attempt = Math.min(maxAttempt, Math.max(0, Math.floor(args.attempt ?? 0)));

    try {
      await ensureStripeCustomerForUser(ctx, args.userId);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage === "User not found") {
        console.warn(
          `[users.ensureStripeCustomerWithRetry] User not found, skipping retry for ${args.userId}`,
        );
        return null;
      }

      const nextAttempt = attempt + 1;
      if (nextAttempt <= maxAttempt) {
        const retryDelayMs = STRIPE_CUSTOMER_SYNC_RETRY_DELAYS_MS[nextAttempt];
        console.error(
          `[users.ensureStripeCustomerWithRetry] Failed attempt ${attempt + 1}/${STRIPE_CUSTOMER_SYNC_RETRY_DELAYS_MS.length} for ${args.userId}. Retrying in ${retryDelayMs}ms.`,
          error,
        );
        await ctx.scheduler.runAfter(
          retryDelayMs,
          internal.users.ensureStripeCustomerWithRetry,
          {
            userId: args.userId,
            attempt: nextAttempt,
          },
        );
      } else {
        console.error(
          `[users.ensureStripeCustomerWithRetry] Exhausted retries for ${args.userId}.`,
          error,
        );
      }
      return null;
    }
  },
});

// Internal mutation to update Stripe customer ID (for use by internal actions)
export const updateStripeCustomerIdInternal = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

// Internal mutation to update user stats (only called by system)
export const updateStats = internalMutation({
  args: {
    userId: v.id("users"),
    timesServiced: v.optional(v.number()),
    totalSpent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updateData: any = {};
    if (args.timesServiced !== undefined) {
      updateData.timesServiced = args.timesServiced;
    }
    if (args.totalSpent !== undefined) {
      updateData.totalSpent = args.totalSpent;
    }
    await ctx.db.patch(args.userId, updateData);
    return args.userId;
  },
});

// Action to create Stripe invoice for user appointment
export const createUserAppointmentInvoice = action({
  args: {
    userId: v.id("users"),
    appointmentId: v.id("appointments"),
    services: v.array(
      v.object({
        _id: v.id("services"),
        stripePriceIds: v.array(v.string()),
        basePriceSmall: v.optional(v.number()),
        basePriceMedium: v.optional(v.number()),
        basePriceLarge: v.optional(v.number()),
        name: v.string(),
      }),
    ),
    vehicles: v.array(
      v.object({
        size: v.optional(
          v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
        ),
      }),
    ),
    totalPrice: v.number(),
    scheduledDate: v.string(),
  },
  returns: v.object({
    stripeInvoiceId: v.string(),
    stripeInvoiceUrl: v.string(),
    invoiceNumber: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    stripeInvoiceId: string;
    stripeInvoiceUrl: string;
    invoiceNumber: string;
  }> => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    // Get user data
    const user: Doc<"users"> | null = await ctx.runQuery(api.users.getById, {
      userId: args.userId,
    });
    if (!user) throw new Error("User not found");

    // Note: User stats (timesServiced, totalSpent) should be updated when appointment is completed,
    // not when invoice is created. This is handled in the appointment completion flow.

    // Check if user has Stripe customer ID, create if not
    let stripeCustomerId: string | undefined = user.stripeCustomerId;
    if (!stripeCustomerId) {
      // Create Stripe customer
      const customerResponse = await fetch(
        "https://api.stripe.com/v1/customers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: user.email || "",
            name: user.name || "",
            phone: user.phone || "",
            "address[line1]": user.address?.street || "",
            "address[city]": user.address?.city || "",
            "address[state]": user.address?.state || "",
            "address[postal_code]": user.address?.zip || "",
            "address[country]": "US",
          }),
        },
      );

      if (!customerResponse.ok) {
        throw new Error("Failed to create Stripe customer");
      }

      const stripeCustomer: any = await customerResponse.json();
      stripeCustomerId = stripeCustomer.id;

      // Update user with Stripe customer ID
      // stripeCustomerId is guaranteed to be a string here since we just assigned it
      await ctx.runMutation(api.users.updateStripeCustomerId, {
        userId: args.userId,
        stripeCustomerId: stripeCustomerId!,
      });
    }

    // Create invoice items using existing Stripe price IDs from services
    const vehicleSize = args.vehicles[0]?.size || "medium";

    for (const service of args.services) {
      if (!service.stripePriceIds || service.stripePriceIds.length === 0) {
        throw new Error(`Service ${service.name} has no Stripe price IDs`);
      }

      // Find the appropriate price ID based on vehicle size
      let priceIndex = 1; // Default to medium (index 1)
      if (vehicleSize === "small") priceIndex = 0;
      else if (vehicleSize === "large") priceIndex = 2;

      const stripePriceId =
        service.stripePriceIds[priceIndex] ||
        service.stripePriceIds[1] ||
        service.stripePriceIds[0];

      if (!stripePriceId) {
        throw new Error(
          `No Stripe price found for service ${service.name} and size ${vehicleSize}`,
        );
      }

      // Create invoice item
      const invoiceItemResponse = await fetch(
        "https://api.stripe.com/v1/invoiceitems",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            customer: stripeCustomerId!,
            price: stripePriceId,
            quantity: args.vehicles.length.toString(),
          }),
        },
      );

      if (!invoiceItemResponse.ok) {
        const errorText = await invoiceItemResponse.text();
        throw new Error(`Failed to create invoice item: ${errorText}`);
      }
    }

    // Create the invoice
    const appointmentDate = new Date(args.scheduledDate);
    const dueDate = new Date(appointmentDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const invoiceResponse: Response = await fetch(
      "https://api.stripe.com/v1/invoices",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: stripeCustomerId!,
          collection_method: "send_invoice",
          days_until_due: "30",
          auto_advance: "true",
          description: `Mobile detailing service - ${args.scheduledDate}`,
        }),
      },
    );

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      throw new Error(`Failed to create Stripe invoice: ${errorText}`);
    }

    const stripeInvoice: any = await invoiceResponse.json();

    // Send the invoice (Stripe will email it automatically)
    const sendResponse: Response = await fetch(
      `https://api.stripe.com/v1/invoices/${stripeInvoice.id}/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`Failed to send Stripe invoice: ${errorText}`);
    }

    const sentInvoice: any = await sendResponse.json();

    // Generate invoice number
    const invoiceCount: number = (await ctx.runQuery(api.invoices.getCount, {}))
      .count;
    const invoiceNumber: string = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;

    // Create invoice items for Convex
    const items = args.services.map((service) => {
      // Calculate the correct price based on vehicle size
      let unitPrice = service.basePriceMedium || 0;
      if (vehicleSize === "small") {
        unitPrice = service.basePriceSmall || service.basePriceMedium || 0;
      } else if (vehicleSize === "large") {
        unitPrice = service.basePriceLarge || service.basePriceMedium || 0;
      }

      return {
        serviceId: service._id,
        serviceName: service.name,
        quantity: args.vehicles.length,
        unitPrice,
        totalPrice: unitPrice * args.vehicles.length,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = 0;
    const total = subtotal + tax;

    // Get deposit amount from settings (default $50 per vehicle)
    const depositSettings = await ctx.runQuery(api.depositSettings.get, {});
    const depositPerVehicle = depositSettings?.amountPerVehicle ?? 50;
    const calculatedDepositAmount = depositPerVehicle * args.vehicles.length;
    // Cap deposit at total to prevent negative remaining balance
    const depositAmount = Math.min(calculatedDepositAmount, total);
    const remainingBalance = Math.max(0, total - depositAmount);

    // Store invoice in Convex with Stripe data
    await ctx.runMutation(api.invoices.create, {
      appointmentId: args.appointmentId,
      userId: args.userId,
      invoiceNumber,
      items,
      subtotal,
      tax,
      total,
      status: "draft", // Start as draft, will be sent after deposit is paid
      dueDate: dueDate.toISOString().split("T")[0],
      stripeInvoiceId: sentInvoice.id,
      stripeInvoiceUrl: sentInvoice.hosted_invoice_url,
      notes: `Invoice for appointment on ${args.scheduledDate}`,
      depositAmount,
      depositPaid: false,
      remainingBalance,
    });

    return {
      stripeInvoiceId: sentInvoice.id,
      stripeInvoiceUrl: sentInvoice.hosted_invoice_url,
      invoiceNumber,
    };
  },
});
