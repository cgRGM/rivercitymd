import {
  query,
  mutation,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

// Get count of new customers (created in last 30 days, admin only)
export const getNewCustomersCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(userId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const users = await ctx.db.query("users").collect();

    // Filter for customers (not admins) created in last 30 days
    const newCustomers = users.filter(
      (user) => user.role !== "admin" && user._creationTime >= thirtyDaysAgo,
    );

    return newCustomers.length;
  },
});

// Get all users (admin only)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(userId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

    return await ctx.db.query("users").collect();
  },
});

// Get user by ID
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    // Users can only see their own data, admins can see all
    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin" && authUserId !== args.userId) {
      throw new Error("Access denied");
    }

    return await ctx.db.get(args.userId);
  },
});

// Get the current user's profile
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
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
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
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
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Update user with onboarding data
    await ctx.db.patch(userId, {
      name: args.name,
      phone: args.phone,
      address: args.address,
      timesServiced: 0,
      totalSpent: 0,
      status: "active",
    });

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

    return { userId };
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
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(authUserId);
    const isAdmin = currentUser?.role === "admin";
    const isOwnProfile = authUserId === args.userId;

    // Users can update their own profile, admins can update any profile
    if (!isAdmin && !isOwnProfile) {
      throw new Error("Access denied");
    }

    const { userId, ...updates } = args;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.role !== undefined && isAdmin) updateData.role = updates.role;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined && isAdmin)
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.address !== undefined) updates.address = args.address;

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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    if (vehicle.userId !== userId) {
      const currentUser = await ctx.db.get(userId);
      if (currentUser?.role !== "admin") {
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
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

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
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(authUserId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(userId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

    const users = await ctx.db.query("users").collect();
    // Filter out admin users from customer list
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
      .withIndex("email", (q) => q.eq("email", args.email))
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

// Internal action to ensure Stripe customer exists (for use by mutations)
export const ensureStripeCustomer = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.string(), // Returns stripeCustomerId
  handler: async (ctx, args): Promise<string> => {
    const user = await ctx.runQuery(internal.users.getByIdInternal, {
      userId: args.userId,
    });
    if (!user) throw new Error("User not found");

    // If user already has Stripe customer ID, return it
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create Stripe customer
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      // Throw an explicit error to maintain the function contract and surface
      // configuration issues early; include the userId to aid debugging in any environment.
      throw new Error(
        `STRIPE_SECRET_KEY environment variable is not set for user ${args.userId}`,
      );
    }

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
          "metadata[convexUserId]": args.userId,
        }),
      },
    );

    if (!customerResponse.ok) {
      const error = await customerResponse.json();
      throw new Error(
        `Failed to create Stripe customer: ${JSON.stringify(error)}`,
      );
    }

    const stripeCustomer: any = await customerResponse.json();
    const stripeCustomerId = stripeCustomer.id;

    // Update user with Stripe customer ID
    await ctx.runMutation(internal.users.updateStripeCustomerIdInternal, {
      userId: args.userId,
      stripeCustomerId,
    });

    return stripeCustomerId;
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
