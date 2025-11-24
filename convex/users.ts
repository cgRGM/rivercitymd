import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

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

// Get users with statistics (total bookings, last visit, etc.) - admin only
export const listWithStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentUser = await ctx.db.get(userId);
    if (currentUser?.role !== "admin") throw new Error("Admin access required");

    const users = await ctx.db.query("users").collect();

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
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
export const createUserWithAppointment = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    password: v.string(),
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
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error(
        "An account with this email already exists. Please sign in instead.",
      );
    }

    // Create the user account
    const userId = await ctx.db.insert("users", {
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

    // Create invoice
    const invoiceCount = (await ctx.db.query("invoices").collect()).length;
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, "0")}`;

    const items = validServices.map((service) => ({
      serviceId: service!._id,
      serviceName: service!.name,
      quantity: vehicleIds.length,
      unitPrice: service!.basePrice,
      totalPrice: service!.basePrice * vehicleIds.length,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = 0;
    const total = subtotal + tax;

    const appointmentDate = new Date(args.scheduledDate);
    const dueDate = new Date(
      appointmentDate.setDate(appointmentDate.getDate() + 30),
    );
    const dueDateString = dueDate.toISOString().split("T")[0];

    await ctx.db.insert("invoices", {
      appointmentId,
      userId,
      invoiceNumber,
      items,
      subtotal,
      tax,
      total,
      status: "draft",
      dueDate: dueDateString,
      notes: `Invoice for appointment on ${args.scheduledDate}`,
    });

    return { userId, appointmentId };
  },
});
