import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Customize users table to include role and basic info
const schema = defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    // Custom fields
    role: v.optional(v.union(v.literal("admin"), v.literal("client"))),
    // Client fields (users are clients)
    address: v.optional(
      v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        zip: v.string(),
      }),
    ),
    timesServiced: v.optional(v.number()),
    totalSpent: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    cancellationCount: v.optional(v.number()),
    notes: v.optional(v.string()),
    // Payment fields
    stripeCustomerId: v.optional(v.string()),
  }).index("email", ["email"]),

  // Business Information
  businessInfo: defineTable({
    name: v.string(),
    owner: v.string(),
    address: v.string(),
    cityStateZip: v.string(),
    country: v.string(),
    logoId: v.optional(v.id("_storage")),
    notificationSettings: v.optional(
      v.object({
        emailNotifications: v.boolean(),
        smsNotifications: v.boolean(),
        marketingEmails: v.boolean(),
      }),
    ),
  }),

  // Vehicle information
  vehicles: defineTable({
    userId: v.id("users"),
    year: v.number(),
    make: v.string(),
    model: v.string(),
    color: v.optional(v.string()),
    licensePlate: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Service Categories
  serviceCategories: defineTable({
    name: v.string(),
    type: v.union(v.literal("standard"), v.literal("subscription")),
  }),

  // Services and Subscriptions
  services: defineTable({
    name: v.string(),
    description: v.string(),
    basePrice: v.number(), // deprecated - kept for backwards compatibility
    basePriceSmall: v.optional(v.number()),
    basePriceMedium: v.optional(v.number()),
    basePriceLarge: v.optional(v.number()),
    duration: v.number(), // in minutes
    categoryId: v.id("serviceCategories"),
    includedServiceIds: v.optional(v.array(v.id("services"))),
    isActive: v.boolean(),
    // NEW FIELDS:
    features: v.optional(v.array(v.string())), // Service features list
    icon: v.optional(v.string()), // Emoji or icon identifier
    stripeProductId: v.optional(v.string()), // Stripe product ID
  }).index("by_category", ["categoryId"]),

  // Appointments/Bookings
  appointments: defineTable({
    userId: v.id("users"),
    vehicleIds: v.array(v.id("vehicles")),
    serviceIds: v.array(v.id("services")),
    scheduledDate: v.string(), // ISO date string
    scheduledTime: v.string(), // HH:MM format
    duration: v.number(), // total duration in minutes
    location: v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
      notes: v.optional(v.string()),
    }),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
    totalPrice: v.number(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_date", ["scheduledDate"])
    .index("by_status", ["status"]),

  // Payment Methods
  paymentMethods: defineTable({
    userId: v.id("users"),
    stripePaymentMethodId: v.string(),
    type: v.union(v.literal("card"), v.literal("bank_account")),
    last4: v.string(),
    brand: v.optional(v.string()), // For cards
    isDefault: v.boolean(),
    createdAt: v.string(),
  }).index("by_user", ["userId"]),

  // Invoices
  invoices: defineTable({
    appointmentId: v.id("appointments"),
    userId: v.id("users"),
    invoiceNumber: v.string(),
    items: v.array(
      v.object({
        serviceId: v.id("services"),
        serviceName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        totalPrice: v.number(),
      }),
    ),
    subtotal: v.number(),
    tax: v.number(),
    total: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
    ),
    dueDate: v.string(),
    paidDate: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    paymentMethodId: v.optional(v.id("paymentMethods")),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_appointment", ["appointmentId"])
    .index("by_status", ["status"])
    .index("by_invoice_number", ["invoiceNumber"]),

  // Reviews
  reviews: defineTable({
    userId: v.id("users"),
    appointmentId: v.id("appointments"),
    rating: v.number(), // 1-5 stars
    comment: v.optional(v.string()),
    isPublic: v.boolean(),
    reviewDate: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_appointment", ["appointmentId"]),

  // Chat messages
  chatMessages: defineTable({
    appointmentId: v.optional(v.id("appointments")),
    userId: v.id("users"),
    senderId: v.id("users"),
    senderType: v.union(v.literal("client"), v.literal("admin")),
    message: v.string(),
    messageType: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("system"),
    ),
    isRead: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_appointment", ["appointmentId"]),

  // Business availability
  availability: defineTable({
    dayOfWeek: v.number(), // 0-6 (Sunday-Saturday)
    startTime: v.string(), // HH:MM format
    endTime: v.string(), // HH:MM format
    isActive: v.boolean(),
  }),

  // Time off / blocked times
  timeBlocks: defineTable({
    date: v.string(), // ISO date string
    startTime: v.string(),
    endTime: v.string(),
    reason: v.string(),
    type: v.union(
      v.literal("time_off"),
      v.literal("maintenance"),
      v.literal("other"),
    ),
    createdBy: v.id("users"),
  }).index("by_date", ["date"]),
});

export default schema;
