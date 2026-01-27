import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("vehicles", () => {
  test("getByUser returns vehicles for authenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Vehicle Owner",
        email: "vehicle@example.com",
        role: "client",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("vehicles", {
        userId,
        year: 2022,
        make: "Honda",
        model: "Civic",
        color: "Silver",
      });
    });

    const asUser = t.withIdentity({ subject: userId, email: "vehicle@example.com" });
    const vehicles = await asUser.query(api.vehicles.getByUser, { userId });
    expect(vehicles.length).toBe(1);
    expect(vehicles[0]).toMatchObject({
      year: 2022,
      make: "Honda",
      model: "Civic",
      color: "Silver",
      userId,
    });
  });

  test("create adds vehicle for self", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "New Owner",
        email: "newowner@example.com",
        role: "client",
      });
    });

    const asUser = t.withIdentity({ subject: userId, email: "newowner@example.com" });
    const vehicleId = await asUser.mutation(api.vehicles.create, {
      userId,
      year: 2023,
      make: "Toyota",
      model: "Corolla",
    });

    expect(vehicleId).toBeDefined();

    const myVehicles = await asUser.query(api.vehicles.getMyVehicles, {});
    expect(myVehicles.length).toBe(1);
    expect(myVehicles[0]).toMatchObject({
      year: 2023,
      make: "Toyota",
      model: "Corolla",
    });
  });
});
