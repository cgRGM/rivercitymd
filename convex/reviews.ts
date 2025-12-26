import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all reviews for admin (with customer and appointment details)
export const listForAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("reviews"),
      _creationTime: v.number(),
      userId: v.id("users"),
      appointmentId: v.id("appointments"),
      rating: v.number(),
      comment: v.optional(v.string()),
      isPublic: v.boolean(),
      reviewDate: v.string(),
      customerName: v.string(),
      customerEmail: v.string(),
      appointmentDate: v.union(v.string(), v.null()),
      services: v.array(
        v.object({
          _id: v.id("services"),
          _creationTime: v.number(),
          name: v.string(),
          description: v.string(),
          basePrice: v.number(),
          basePriceSmall: v.optional(v.number()),
          basePriceMedium: v.optional(v.number()),
          basePriceLarge: v.optional(v.number()),
          duration: v.number(),
          categoryId: v.id("serviceCategories"),
          includedServiceIds: v.optional(v.array(v.id("services"))),
          isActive: v.boolean(),
          features: v.optional(v.array(v.string())),
          icon: v.optional(v.string()),
          stripeProductId: v.optional(v.string()),
          stripePriceIds: v.optional(v.array(v.string())),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(userId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

    const reviews = await ctx.db.query("reviews").collect();

    // Enrich reviews with customer and appointment details
    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        const appointment = await ctx.db.get(review.appointmentId);

        const services = appointment
          ? await Promise.all(
              appointment.serviceIds.map((id) => ctx.db.get(id)),
            )
          : [];

        return {
          ...review,
          customerName: user?.name || "Unknown Customer",
          customerEmail: user?.email || "",
          appointmentDate: appointment?.scheduledDate || null,
          services: services.filter((s) => s !== null),
        };
      }),
    );

    return enrichedReviews.sort((a, b) => {
      const dateA = new Date(a.reviewDate).getTime();
      const dateB = new Date(b.reviewDate).getTime();
      return dateB - dateA; // Most recent first
    });
  },
});

// Get all reviews
export const list = query({
  args: {
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("reviews");

    const reviews = await query.collect();

    if (args.isPublic !== undefined) {
      return reviews.filter((review) => review.isPublic === args.isPublic);
    }

    return reviews;
  },
});

// Get reviews for a user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own reviews, admins can see all
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get user's reviews with appointment details
export const getUserReviewsWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Join with appointment and service details
    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        const appointment = await ctx.db.get(review.appointmentId);
        if (!appointment) return null;

        const services = await Promise.all(
          appointment.serviceIds.map((id) => ctx.db.get(id)),
        );
        const vehicles = await Promise.all(
          appointment.vehicleIds.map((id) => ctx.db.get(id)),
        );

        return {
          ...review,
          appointment: {
            ...appointment,
            services: services.filter((s) => s !== null),
            vehicles: vehicles.filter((v) => v !== null),
          },
        };
      }),
    );

    return enrichedReviews.filter((r) => r !== null);
  },
});

// Get pending reviews (completed appointments without reviews)
export const getPendingReviews = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get all completed appointments for this user
    const completedAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Get existing reviews
    const existingReviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const reviewedAppointmentIds = new Set(
      existingReviews.map((r) => r.appointmentId),
    );

    // Filter out appointments that already have reviews
    const pendingAppointments = completedAppointments.filter(
      (apt) => !reviewedAppointmentIds.has(apt._id),
    );

    // Join with service and vehicle details
    const enrichedPending = await Promise.all(
      pendingAppointments.map(async (appointment) => {
        const services = await Promise.all(
          appointment.serviceIds.map((id) => ctx.db.get(id)),
        );
        const vehicles = await Promise.all(
          appointment.vehicleIds.map((id) => ctx.db.get(id)),
        );

        return {
          ...appointment,
          services: services.filter((s) => s !== null),
          vehicles: vehicles.filter((v) => v !== null),
        };
      }),
    );

    return enrichedPending;
  },
});

// Request review (creates a system message)
export const requestReview = mutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    // Send a chat message requesting review
    await ctx.db.insert("chatMessages", {
      userId: appointment.userId,
      appointmentId: args.appointmentId,
      senderId: userId,
      senderType: "admin",
      message:
        "Thank you for choosing RiverCityMD! We'd love to hear about your experience. Please leave us a review when you have a moment.",
      messageType: "system",
      isRead: false,
    });

    return true;
  },
});

// Submit review (would typically be called by client)
export const submit = mutation({
  args: {
    appointmentId: v.id("appointments"),
    rating: v.number(),
    comment: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    return await ctx.db.insert("reviews", {
      userId: appointment.userId,
      appointmentId: args.appointmentId,
      rating: args.rating,
      comment: args.comment,
      isPublic: args.isPublic,
      reviewDate: new Date().toISOString(),
    });
  },
});
