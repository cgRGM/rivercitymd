import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { r2 } from "./r2";

type SeedUserArgs = {
  name: string;
  email: string;
  clerkUserId: string;
  role: "admin" | "client";
};

async function seedUser(t: any, args: SeedUserArgs) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      clerkUserId: args.clerkUserId,
      role: args.role,
      timesServiced: 0,
      totalSpent: 0,
      status: "active",
    });
  });
}

describe("tripLogs", () => {
  test("requires start location before completing a draft", async () => {
    const t = convexTest(schema, modules);

    await seedUser(t, {
      name: "Admin",
      email: "trip-admin@test.com",
      clerkUserId: "clerk_trip_admin",
      role: "admin",
    });

    const asAdmin = t.withIdentity({
      subject: "clerk_trip_admin",
      email: "trip-admin@test.com",
    });

    const tripLogId = await asAdmin.mutation((api as any).tripLogs.createManualDraft, {
      logDate: "2026-02-15",
      start: {},
      stops: [
        {
          addressLabel: "706 Walnut St, NLR, AR 72114",
          street: "706 Walnut St",
          city: "North Little Rock",
          state: "AR",
          postalCode: "72114",
        },
      ],
      businessPurpose: "Interior detail appointment",
      mileage: {
        finalMiles: 12,
        mileageSource: "manual",
      },
    });

    await expect(
      asAdmin.mutation((api as any).tripLogs.markCompleted, { tripLogId }),
    ).rejects.toThrow("Start location is required");
  });

  test("recomputes expense totals on add, update, and delete", async () => {
    const t = convexTest(schema, modules);

    await seedUser(t, {
      name: "Admin",
      email: "trip-admin-2@test.com",
      clerkUserId: "clerk_trip_admin_2",
      role: "admin",
    });

    const asAdmin = t.withIdentity({
      subject: "clerk_trip_admin_2",
      email: "trip-admin-2@test.com",
    });

    const tripLogId = await asAdmin.mutation((api as any).tripLogs.createManualDraft, {
      logDate: "2026-02-20",
      start: {
        addressLabel: "300 S Donaghey Ave, Conway, AR 72034",
        street: "300 S Donaghey Ave",
        city: "Conway",
        state: "AR",
        postalCode: "72034",
      },
      stops: [
        {
          addressLabel: "8755 Sheltie Dr, Little Rock, AR 72205",
          street: "8755 Sheltie Dr",
          city: "Little Rock",
          state: "AR",
          postalCode: "72205",
        },
      ],
      businessPurpose: "Supply pickup and delivery",
      mileage: {
        finalMiles: 15,
        mileageSource: "manual",
      },
    });

    const expenseOneId = await asAdmin.mutation((api as any).tripLogs.upsertExpenseLine, {
      tripLogId,
      incurredDate: "2026-02-20",
      category: "fuel",
      amountCents: 2500,
      merchant: "Shell",
    });

    await asAdmin.mutation((api as any).tripLogs.upsertExpenseLine, {
      tripLogId,
      incurredDate: "2026-02-20",
      category: "supplies",
      amountCents: 1000,
      merchant: "Home Depot",
    });

    let tripLog = await asAdmin.query((api as any).tripLogs.getById, { tripLogId });
    expect(tripLog?.expenseTotalCents).toBe(3500);

    await asAdmin.mutation((api as any).tripLogs.upsertExpenseLine, {
      expenseId: expenseOneId,
      tripLogId,
      incurredDate: "2026-02-20",
      category: "fuel",
      amountCents: 500,
      merchant: "Shell",
    });

    tripLog = await asAdmin.query((api as any).tripLogs.getById, { tripLogId });
    expect(tripLog?.expenseTotalCents).toBe(1500);

    const suppliesExpense = tripLog?.expenses.find(
      (expense: { category: string }) => expense.category === "supplies",
    );
    expect(suppliesExpense?._id).toBeDefined();

    await asAdmin.mutation((api as any).tripLogs.deleteExpenseLine, {
      expenseId: suppliesExpense._id,
    });

    tripLog = await asAdmin.query((api as any).tripLogs.getById, { tripLogId });
    expect(tripLog?.expenseTotalCents).toBe(500);
  });

  test("blocks non-admin access to trip log APIs", async () => {
    const t = convexTest(schema, modules);

    await seedUser(t, {
      name: "Client",
      email: "trip-client@test.com",
      clerkUserId: "clerk_trip_client",
      role: "client",
    });

    const asClient = t.withIdentity({
      subject: "clerk_trip_client",
      email: "trip-client@test.com",
    });

    await expect(asClient.query((api as any).tripLogs.list, {})).rejects.toThrow(
      "Admin access required",
    );
  });

  test("allows only image receipts and rejects non-image uploads", async () => {
    const t = convexTest(schema, modules);

    await seedUser(t, {
      name: "Admin",
      email: "trip-admin-3@test.com",
      clerkUserId: "clerk_trip_admin_3",
      role: "admin",
    });

    const asAdmin = t.withIdentity({
      subject: "clerk_trip_admin_3",
      email: "trip-admin-3@test.com",
    });

    const generateUploadUrlSpy = vi
      .spyOn(r2, "generateUploadUrl")
      .mockResolvedValue({ key: "trip-logs/test/receipt.png", url: "https://example.com/upload" });
    const getUrlSpy = vi
      .spyOn(r2, "getUrl")
      .mockResolvedValue("https://example.com/receipt.png");

    try {
      const tripLogId = await asAdmin.mutation((api as any).tripLogs.createManualDraft, {
        logDate: "2026-03-05",
        start: {
          addressLabel: "300 S Donaghey Ave, Conway, AR 72034",
          street: "300 S Donaghey Ave",
          city: "Conway",
          state: "AR",
          postalCode: "72034",
        },
        stops: [
          {
            addressLabel: "706 Walnut St, NLR, AR 72114",
            street: "706 Walnut St",
            city: "North Little Rock",
            state: "AR",
            postalCode: "72114",
          },
        ],
        businessPurpose: "Tax log run",
        mileage: {
          finalMiles: 11,
          mileageSource: "manual",
        },
      });

      const expenseId = await asAdmin.mutation((api as any).tripLogs.upsertExpenseLine, {
        tripLogId,
        incurredDate: "2026-03-05",
        category: "supplies",
        amountCents: 1200,
      });

      await expect(
        asAdmin.mutation((api as any).tripLogs.createReceiptUploadUrl, {
          tripLogId,
          expenseId,
          fileName: "receipt.csv",
          contentType: "text/csv",
        }),
      ).rejects.toThrow("Only JPG, PNG, WEBP, and GIF image receipts are allowed.");

      await expect(
        asAdmin.mutation((api as any).tripLogs.attachReceipt, {
          expenseId,
          key: "trip-logs/test/receipt.csv",
          fileName: "receipt.csv",
          contentType: "text/csv",
          sizeBytes: 18,
        }),
      ).rejects.toThrow("Only JPG, PNG, WEBP, and GIF image receipts are allowed.");

      const upload = await asAdmin.mutation((api as any).tripLogs.createReceiptUploadUrl, {
        tripLogId,
        expenseId,
        fileName: "receipt.png",
        contentType: "image/png",
      });

      expect(upload.key).toContain("trip-logs/");
      expect(upload.url).toBe("https://example.com/upload");

      await asAdmin.mutation((api as any).tripLogs.attachReceipt, {
        expenseId,
        key: upload.key,
        fileName: "receipt.png",
        contentType: "image/png",
        sizeBytes: 24576,
      });

      const tripLog = await asAdmin.query((api as any).tripLogs.getById, { tripLogId });
      const expense = tripLog?.expenses.find((entry: { _id: string }) => entry._id === expenseId);
      expect(expense?.receipts.length).toBe(1);
      expect(expense?.receipts[0].isImage).toBe(true);
      expect(expense?.receipts[0].signedUrl).toBe("https://example.com/receipt.png");
    } finally {
      generateUploadUrlSpy.mockRestore();
      getUrlSpy.mockRestore();
    }
  });
});
