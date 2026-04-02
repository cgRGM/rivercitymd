import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getNormalizedIdentityEmail, getUserIdFromIdentity } from "./auth";

const BOOKING_CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function buildClaimRedirectPath(onboardingComplete: boolean) {
  return onboardingComplete
    ? "/dashboard/appointments?payment=success"
    : "/onboarding?payment=success";
}

export const createInternal = internalMutation({
  args: {
    token: v.string(),
    appointmentId: v.id("appointments"),
    userId: v.id("users"),
    email: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("bookingClaims", {
      token: args.token,
      appointmentId: args.appointmentId,
      userId: args.userId,
      email: args.email,
      createdAt: now,
      expiresAt: now + BOOKING_CLAIM_TTL_MS,
    });

    return args.token;
  },
});

export const getPublicContext = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal("available"),
        v.literal("claimed"),
        v.literal("expired"),
      ),
      email: v.string(),
      appointmentId: v.id("appointments"),
      scheduledDate: v.string(),
      scheduledTime: v.string(),
      serviceNames: v.array(v.string()),
      claimedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("bookingClaims")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!claim) {
      return null;
    }

    const appointment = await ctx.db.get(claim.appointmentId);
    if (!appointment) {
      return null;
    }

    const services = await Promise.all(
      appointment.serviceIds.map((serviceId) => ctx.db.get(serviceId)),
    );

    const status: "available" | "claimed" | "expired" =
      claim.expiresAt < Date.now()
        ? "expired"
        : claim.claimedAt
          ? "claimed"
          : "available";

    return {
      status,
      email: claim.email,
      appointmentId: claim.appointmentId,
      scheduledDate: appointment.scheduledDate,
      scheduledTime: appointment.scheduledTime,
      serviceNames: services
        .filter((service): service is NonNullable<typeof service> => service !== null)
        .map((service) => service.name),
      claimedAt: claim.claimedAt,
    };
  },
});

export const claim = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    redirectPath: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new ConvexError("You need to sign in before claiming this booking.");
    }

    const claim = await ctx.db
      .query("bookingClaims")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!claim || claim.expiresAt < Date.now()) {
      throw new ConvexError(
        "This booking link is invalid or has expired. Please request a new one.",
      );
    }

    const currentUserId = await getUserIdFromIdentity(ctx);
    const normalizedClaimEmail = normalizeEmail(claim.email);
    const normalizedIdentityEmail = normalizeEmail(
      getNormalizedIdentityEmail(identity),
    );

    if (
      claim.claimedAt &&
      claim.claimedByClerkUserId &&
      claim.claimedByClerkUserId !== identity.subject
    ) {
      throw new ConvexError("This booking has already been claimed.");
    }

    if (currentUserId && currentUserId !== claim.userId) {
      throw new ConvexError(
        "This signed-in account is already linked to a different customer record. Please sign in with the booking email instead.",
      );
    }

    if (!currentUserId && normalizedIdentityEmail !== normalizedClaimEmail) {
      throw new ConvexError(
        `This booking was created with ${claim.email}. Sign in or create an account with that email to attach it.`,
      );
    }

    const bookingUser = await ctx.db.get(claim.userId);
    if (!bookingUser) {
      throw new ConvexError("We couldn't find the booking attached to this link.");
    }

    if (
      bookingUser.clerkUserId &&
      bookingUser.clerkUserId !== identity.subject &&
      currentUserId !== claim.userId
    ) {
      throw new ConvexError(
        "This booking is already linked to another account. Please contact support if that looks wrong.",
      );
    }

    if (!bookingUser.clerkUserId) {
      await ctx.db.patch(bookingUser._id, {
        clerkUserId: identity.subject,
      });
    }

    if (!claim.claimedAt) {
      await ctx.db.patch(claim._id, {
        claimedAt: Date.now(),
        claimedByUserId: bookingUser._id,
        claimedByClerkUserId: identity.subject,
      });
    }

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", bookingUser._id))
      .collect();

    const onboardingComplete = Boolean(
      bookingUser.name &&
        bookingUser.phone &&
        bookingUser.address &&
        vehicles.length > 0,
    );

    return {
      redirectPath: buildClaimRedirectPath(onboardingComplete),
    };
  },
});
