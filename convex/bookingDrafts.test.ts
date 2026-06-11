import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("bookingDrafts out-of-area requests", () => {
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
});
