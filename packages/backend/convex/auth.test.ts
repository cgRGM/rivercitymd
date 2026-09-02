import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("auth identity resolution", () => {
  test("prefers Clerk subject lookup over email lookup", async () => {
    const t = convexTest(schema, modules);

    const userBySubjectId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "subject-priority@example.com",
        clerkUserId: "clerk_subject_priority",
        role: "client",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        email: "other-user@example.com",
        clerkUserId: "clerk_other_user",
        role: "client",
      });
    });

    const asUser = t.withIdentity({
      subject: "clerk_subject_priority",
      email: "other-user@example.com",
    } as any);

    const currentUser = await asUser.query(api.auth.getCurrentUser, {});
    expect(currentUser?.userId).toBe(userBySubjectId);
  });

  test("mutation resolves object-shaped email claims and auto-links clerkUserId", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "object-claim@example.com",
        role: "client",
      });
    });

    const asUser = t.withIdentity({
      subject: "clerk_object_claim",
      email: {
        email_address: "object-claim@example.com",
      },
    } as any);

    await asUser.mutation(api.users.updateUserProfile, {
      phone: "555-1212",
    });

    const updatedUser = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(updatedUser?.phone).toBe("555-1212");
    expect(updatedUser?.clerkUserId).toBe("clerk_object_claim");
  });

  test("action context resolves by Clerk subject without email", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkUserId: "clerk_action_lookup",
        role: "client",
      });
    });

    const asUser = t.withIdentity({
      subject: "clerk_action_lookup",
    } as any);

    const resolvedUserId = await asUser.action(
      (internal.auth as any).getCurrentUserIdForAction,
      {},
    );

    expect(resolvedUserId).toBe(userId);
  });

  test("action context links missing clerkUserId when matched by email fallback", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "json-link@example.com",
        role: "client",
      });
    });

    const asUser = t.withIdentity({
      subject: "clerk_json_link",
      email: "json-link@example.com",
    } as any);

    const resolvedUserId = await asUser.action(
      (internal.auth as any).getCurrentUserIdForAction,
      {},
    );
    expect(resolvedUserId).toBe(userId);

    const updatedUser = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });
    expect(updatedUser?.clerkUserId).toBe("clerk_json_link");
  });
});
