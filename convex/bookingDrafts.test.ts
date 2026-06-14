import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { r2 } from "./r2";
import schema from "./schema";
import { modules } from "./test.setup";

describe("bookingDrafts out-of-area requests", () => {
  test("creates upload URLs for mobile HEIC before photos", async () => {
    const t = convexTest(schema, modules);
    const generateUploadUrlSpy = vi
      .spyOn(r2, "generateUploadUrl")
      .mockResolvedValue({
        key: "booking-before-photos/test/canam.heic",
        url: "https://example.com/upload",
      });

    try {
      const upload = await t.mutation(api.bookingDrafts.createBeforePhotoUploadUrl, {
        fileName: "can-am-before.HEIC",
        contentType: "image/heic",
      });

      expect(upload.url).toBe("https://example.com/upload");
      expect(generateUploadUrlSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^booking-before-photos\/.*can-am-before\.HEIC$/),
      );
    } finally {
      generateUploadUrlSpy.mockRestore();
    }
  });

  test("saves a public out-of-area review request for admin follow-up", async () => {
    const t = convexTest(schema, modules);

    const requestId = await t.mutation(api.bookingDrafts.saveOutOfAreaRequest, {
      name: "Taylor Outside",
      email: "TAYLOR@example.com",
      phone: "(501) 555-1234",
      smsOptIn: true,
      address: {
        street: "100 River Rd",
        city: "Memphis",
        state: "TN",
        zip: "38103",
        notes: "Gate code 1234",
        latitude: 35.1495,
        longitude: -90.049,
      },
      scheduledDate: "2026-07-10",
      scheduledTime: "10:00",
      estimatedDistanceMiles: 137.4,
      estimatedTravelFee: 103.05,
      vehicle: {
        year: 2024,
        make: "Toyota",
        model: "Camry",
        size: "medium",
        hasPet: false,
      },
    });

    const stored = await t.run(async (ctx) => ctx.db.get(requestId));

    expect(stored).toMatchObject({
      customerName: "Taylor Outside",
      customerEmail: "taylor@example.com",
      customerPhone: "(501) 555-1234",
      status: "new",
      estimatedTravelFee: 103.05,
      address: {
        city: "Memphis",
        state: "TN",
      },
      vehicle: {
        year: 2024,
        make: "Toyota",
        model: "Camry",
      },
    });
  });

  test("rate limits repeated out-of-area leads for the same email", async () => {
    const t = convexTest(schema, modules);
    const payload = {
      email: "repeat@example.com",
      address: "New York, NY",
    };

    await t.mutation(api.bookingDrafts.saveOutOfAreaLead, payload);
    await t.mutation(api.bookingDrafts.saveOutOfAreaLead, payload);

    await expect(
      t.mutation(api.bookingDrafts.saveOutOfAreaLead, payload),
    ).rejects.toThrow(/RATE_LIMITED|several requests/i);
  });
});
