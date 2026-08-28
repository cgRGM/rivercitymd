import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("reviews", () => {
  test("list returns empty when no reviews", async () => {
    const t = convexTest(schema, modules);
    const list = await t.query(api.reviews.list, {});
    expect(list).toEqual([]);
  });

  test("submit adds review and list returns it", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "client",
      });
    });

    const appointmentId = await t.run(async (ctx) => {
      return await ctx.db.insert("appointments", {
        userId,
        vehicleIds: [],
        serviceIds: [],
        scheduledDate: "2024-12-01",
        scheduledTime: "10:00",
        duration: 60,
        location: {
          street: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
        },
        status: "completed",
        totalPrice: 100,
        createdBy: userId,
      });
    });

    const reviewId = await t.mutation(api.reviews.submit, {
      appointmentId,
      rating: 5,
      comment: "Great service!",
      isPublic: true,
    });

    expect(reviewId).toBeDefined();

    const list = await t.query(api.reviews.list, {});
    expect(list.length).toBe(1);
    expect(list[0]).toMatchObject({
      rating: 5,
      comment: "Great service!",
      isPublic: true,
      userId,
      appointmentId,
    });

    const asUser = t.withIdentity({ subject: userId, email: "reviewer@example.com" });
    const byUser = await asUser.query(api.reviews.getByUser, { userId });
    expect(byUser.length).toBe(1);
    expect(byUser[0].rating).toBe(5);
  });
});
