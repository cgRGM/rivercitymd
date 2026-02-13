import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("notifications completion handling", () => {
  test("marks sms dispatch failed when action reports delivery failure", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const dispatchId = await t.run(async (ctx) => {
      return await ctx.db.insert("notificationDispatches", {
        dedupeKey: "sms-failed-dispatch",
        event: "appointment_confirmed",
        channel: "sms",
        recipientType: "admin",
        recipient: "+15015550100",
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      t.mutation((internal.notifications as any).handleNotificationCompletion, {
        workId: "work_sms_failed",
        context: {
          dispatchId,
        },
        result: {
          kind: "success",
          returnValue: {
            delivered: false,
            error: "Failed to send request to Twilio",
          },
        },
      }),
    ).resolves.toBeNull();

    const dispatch = await t.run(async (ctx) => {
      return await ctx.db.get(dispatchId);
    });

    expect(dispatch?.status).toBe("failed");
    expect(dispatch?.error).toContain("Failed to send request to Twilio");
  });

  test("marks dispatch sent when delivery succeeds", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const dispatchId = await t.run(async (ctx) => {
      return await ctx.db.insert("notificationDispatches", {
        dedupeKey: "sms-success-dispatch",
        event: "appointment_confirmed",
        channel: "sms",
        recipientType: "admin",
        recipient: "+15015550101",
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.mutation((internal.notifications as any).handleNotificationCompletion, {
      workId: "work_sms_success",
      context: {
        dispatchId,
      },
      result: {
        kind: "success",
        returnValue: {
          delivered: true,
        },
      },
    });

    const dispatch = await t.run(async (ctx) => {
      return await ctx.db.get(dispatchId);
    });

    expect(dispatch?.status).toBe("sent");
    expect(dispatch?.error).toBeUndefined();
  });
});
