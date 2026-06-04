import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { formatAdminBookingSms } from "./lib/notificationMessages";

describe("notification copy", () => {
  test("admin booking SMS calls out before photos and links to the appointment", () => {
    expect(
      formatAdminBookingSms({
        customerName: "Cameron Stewart",
        appointmentDate: "2026-06-04",
        appointmentTime: "9:00 AM",
        photoCount: 2,
        appointmentUrl: "https://rivercitymd.com/admin/appointments/appointment-1",
      }),
    ).toBe(
      "River City MD: New booking received for Cameron Stewart on 2026-06-04 at 9:00 AM. Includes 2 before photos. https://rivercitymd.com/admin/appointments/appointment-1",
    );
  });

  test("admin booking SMS still links directly when no photos were uploaded", () => {
    expect(
      formatAdminBookingSms({
        customerName: "Cameron Stewart",
        appointmentDate: "2026-06-04",
        appointmentTime: "9:00 AM",
        photoCount: 0,
        appointmentUrl: "https://rivercitymd.com/admin/appointments/appointment-1",
      }),
    ).toBe(
      "River City MD: New booking received for Cameron Stewart on 2026-06-04 at 9:00 AM. https://rivercitymd.com/admin/appointments/appointment-1",
    );
  });
});

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
