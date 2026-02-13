import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("users", () => {
  test("create onboarding profile with Clerk subject-only identity", async () => {
    const t = convexTest(schema, modules);

    const clerkUserId = "user_subject_only_123";
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "subject-only@example.com",
        clerkUserId,
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asUser = t.withIdentity({ subject: clerkUserId });

    await asUser.mutation(api.users.createUserProfile, {
      name: "Subject Only User",
      phone: "555-0100",
      address: {
        street: "100 Subject St",
        city: "Little Rock",
        state: "AR",
        zip: "72201",
      },
      vehicles: [
        {
          year: 2020,
          make: "Toyota",
          model: "Camry",
          color: "Gray",
        },
      ],
    });

    const updatedUser = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });
    expect(updatedUser).toMatchObject({
      name: "Subject Only User",
      phone: "555-0100",
      clerkUserId,
      role: "client",
    });
    expect(updatedUser?.address).toMatchObject({
      street: "100 Subject St",
      city: "Little Rock",
      state: "AR",
      zip: "72201",
    });

    const vehicles = await t.run(async (ctx) => {
      return await ctx.db
        .query("vehicles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(vehicles.length).toBe(1);
    expect(vehicles[0]).toMatchObject({
      make: "Toyota",
      model: "Camry",
      color: "Gray",
    });
  });

  test("create user profile during onboarding", async () => {
    const t = convexTest(schema, modules);

    // Create a user with minimal info
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "newuser@example.com",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asUser = t.withIdentity({
      subject: userId,
      email: "newuser@example.com",
    });

    // Update profile during onboarding
    await asUser.mutation(api.users.updateUserProfile, {
      name: "New User",
      phone: "555-0000",
      address: {
        street: "123 New St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
    });

    // Verify profile was updated
    const user = await asUser.query(api.users.getCurrentUser, {});
    expect(user).toMatchObject({
      name: "New User",
      phone: "555-0000",
      email: "newuser@example.com",
    });
  });

  test("get current user", async () => {
    const t = convexTest(schema, modules);

    // Create a user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
        phone: "555-1234",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asUser = t.withIdentity({
      subject: userId,
      email: "test@example.com",
    });

    // Get current user
    const currentUser = await asUser.query(api.users.getCurrentUser, {});

    expect(currentUser).toMatchObject({
      name: "Test User",
      email: "test@example.com",
      phone: "555-1234",
      role: "client",
    });
  });

  test("onboarding status", async () => {
    const t = convexTest(schema, modules);

    // Test user with no profile info
    const incompleteUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: undefined,
        email: "incomplete@example.com",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asIncompleteUser = t.withIdentity({
      subject: incompleteUserId,
      email: "incomplete@example.com",
    });

    const incompleteStatus = await asIncompleteUser.query(
      api.users.getOnboardingStatus,
      {},
    );
    expect(incompleteStatus.isComplete).toBe(false);
    expect(incompleteStatus.missingSteps).toEqual([
      "personal",
      "address",
      "vehicles",
    ]);

    // Test user with complete profile
    const completeUserId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Complete User",
        email: "complete@example.com",
        phone: "555-1111",
        address: {
          street: "123 Complete St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });

      // Add vehicle
      await ctx.db.insert("vehicles", {
        userId,
        year: 2020,
        make: "Nissan",
        model: "Altima",
        color: "Blue",
      });

      return userId;
    });

    const asCompleteUser = t.withIdentity({
      subject: completeUserId,
      email: "complete@example.com",
    });

    const completeStatus = await asCompleteUser.query(
      api.users.getOnboardingStatus,
      {},
    );
    expect(completeStatus.isComplete).toBe(true);
    expect(completeStatus.missingSteps).toEqual([]);
  });

  test("get current user with profile data", async () => {
    const t = convexTest(schema, modules);

    // Create a user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Current User",
        email: "current@example.com",
        phone: "555-9999",
        role: "client",
        timesServiced: 2,
        totalSpent: 150,
        status: "active",
      });
    });

    const asUser = t.withIdentity({
      subject: userId,
      email: "current@example.com",
    });

    // Get current user
    const currentUser = await asUser.query(api.users.getCurrentUser, {});

    expect(currentUser).toMatchObject({
      name: "Current User",
      email: "current@example.com",
      phone: "555-9999",
      role: "client",
      timesServiced: 2,
      totalSpent: 150,
      status: "active",
    });
  });

  test("add and remove vehicles", async () => {
    const t = convexTest(schema, modules);

    // Create a user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Vehicle User",
        email: "vehicle@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asUser = t.withIdentity({
      subject: userId,
      email: "vehicle@example.com",
    });

    // Add a vehicle
    const vehicleId = await asUser.mutation(api.users.addVehicle, {
      year: 2018,
      make: "BMW",
      model: "X3",
      color: "Black",
      licensePlate: "ABC123",
    });

    expect(vehicleId).toBeDefined();

    // Verify vehicle was added
    const vehicles = await asUser.query(api.users.getUserVehicles, {});
    expect(vehicles.length).toBe(1);
    expect(vehicles[0]).toMatchObject({
      year: 2018,
      make: "BMW",
      model: "X3",
      color: "Black",
      licensePlate: "ABC123",
    });

    // Remove vehicle
    await asUser.mutation(api.users.removeVehicle, {
      vehicleId,
    });

    // Verify vehicle was removed
    const vehiclesAfterRemoval = await asUser.query(
      api.users.getUserVehicles,
      {},
    );
    expect(vehiclesAfterRemoval.length).toBe(0);
  });

  test("admin can manage users", async () => {
    const t = convexTest(schema, modules);

    // Create admin user
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin@example.com",
    });

    // Create a client user
    const clientId = await asAdmin.mutation(api.users.create, {
      name: "Client User",
      email: "client@example.com",
      phone: "555-2222",
      role: "client",
      address: {
        street: "789 Client St",
        city: "Springfield",
        state: "IL",
        zip: "62703",
      },
    });

    expect(clientId).toBeDefined();

    // List all users (admin only)
    const users = await asAdmin.query(api.users.list, {});
    expect(users.length).toBeGreaterThanOrEqual(2); // admin + client

    // Get user by ID
    const clientUser = await asAdmin.query(api.users.getById, {
      userId: clientId,
    });
    expect(clientUser).toMatchObject({
      name: "Client User",
      email: "client@example.com",
      phone: "555-2222",
      role: "client",
    });
  });

  test("createUserProfile and retry action sync Stripe customer", async () => {
    const t = convexTest(schema, modules);

    const clerkUserId = "user_profile_sync_123";
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "profilesync@example.com",
        clerkUserId,
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    const asUser = t.withIdentity({
      subject: clerkUserId,
      email: "profilesync@example.com",
    });

    await asUser.mutation(api.users.createUserProfile, {
      name: "Profile Sync",
      phone: "555-0199",
      address: {
        street: "1 Sync St",
        city: "Little Rock",
        state: "AR",
        zip: "72201",
      },
      vehicles: [
        {
          year: 2022,
          make: "Honda",
          model: "Civic",
          color: "Silver",
        },
      ],
    });

    // Validate the same internal retry action used by scheduler can sync the ID.
    await t.action((internal.users as any).ensureStripeCustomerWithRetry, {
      userId,
      attempt: 0,
    });

    const updatedUser = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(updatedUser?.stripeCustomerId).toBe(`cus_test_${userId}`);
  });

  test("ensureStripeCustomerWithRetry does not throw for deleted user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "deleted-user@example.com",
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(userId);
    });

    await expect(
      t.action((internal.users as any).ensureStripeCustomerWithRetry, {
        userId,
        attempt: 0,
      }),
    ).resolves.toBeNull();
  });

  test("backfillMissingStripeCustomers dry run and limit", async () => {
    const t = convexTest(schema, modules);
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-backfill@example.com",
        role: "admin",
      });
    });

    const activeClientA = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "active-client-a@example.com",
        role: "client",
        status: "active",
      });
    });
    const activeClientB = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "active-client-b@example.com",
        role: "client",
        status: "active",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        email: "inactive-client@example.com",
        role: "client",
        status: "inactive",
      });
      await ctx.db.insert("users", {
        email: "already-synced@example.com",
        role: "client",
        status: "active",
        stripeCustomerId: "cus_existing_123",
      });
    });

    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-backfill@example.com",
    });

    const backfillMutation = (api.users as any).backfillMissingStripeCustomers;
    const dryRunResult = await asAdmin.mutation(backfillMutation, {
      dryRun: true,
      limit: 10,
    });
    expect(dryRunResult).toMatchObject({
      scanned: 5,
      eligible: 2,
      scheduled: 0,
      dryRun: true,
    });

    const backfillResult = await asAdmin.mutation(backfillMutation, {
      dryRun: false,
      limit: 1,
    });
    expect(backfillResult).toMatchObject({
      eligible: 2,
      scheduled: 1,
      dryRun: false,
    });

    const userA = await t.run(async (ctx) => ctx.db.get(activeClientA));
    const userB = await t.run(async (ctx) => ctx.db.get(activeClientB));
    // Backfill schedules async work; IDs are not patched synchronously in this mutation.
    expect(userA?.stripeCustomerId).toBeUndefined();
    expect(userB?.stripeCustomerId).toBeUndefined();
  });
});
