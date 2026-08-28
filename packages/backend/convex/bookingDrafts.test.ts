import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { r2 } from "./r2";
import schema from "./schema";
import { modules } from "./test.setup";
import { seedBookingSetup } from "./testUtils/bookingSetup";

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

describe("bookingDrafts pricing validation", () => {
  test("rejects services blocked by vehicle condition before checkout", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t, { includeBookableService: false });

    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Level 1 - Interior Detail",
        description: "Entry interior package.",
        basePrice: 75,
        basePriceSmall: 75,
        basePriceMedium: 90,
        basePriceLarge: 110,
        duration: 60,
        serviceType: "standard",
        isActive: true,
        disallowWhenPetHair: true,
      });
    });

    await expect(
      t.mutation(internal.bookingDrafts.createOrUpdateInternal, {
        name: "Pet Hair Booker",
        email: "pet-hair@example.com",
        phone: "555-0100",
        address: {
          street: "100 Main St",
          city: "Little Rock",
          state: "AR",
          zip: "72201",
        },
        vehicles: [
          {
            year: 2020,
            make: "Toyota",
            model: "Camry",
            size: "medium",
            hasPet: true,
            serviceIds: [serviceId],
          },
        ],
        serviceIds: [serviceId],
        scheduledDate: "2026-08-03",
        scheduledTime: "10:00",
        travelDistanceMiles: 0,
      }),
    ).rejects.toThrow(/higher-level service|SERVICE_NOT_BOOKABLE/i);
  });

  test("calculates correct scheduling duration for multi-vehicle draft without double-counting", async () => {
    const t = convexTest(schema, modules);
    await seedBookingSetup(t, { includeBookableService: false });

    const [service1Id, service2Id] = await t.run(async (ctx) => {
      const s1 = await ctx.db.insert("services", {
        name: "Service A",
        description: "60-minute service",
        basePrice: 100,
        duration: 60,
        serviceType: "standard",
        isActive: true,
      });
      const s2 = await ctx.db.insert("services", {
        name: "Service B",
        description: "30-minute service",
        basePrice: 80,
        duration: 30,
        serviceType: "standard",
        isActive: true,
      });
      return [s1, s2];
    });

    const draft = await t.mutation(internal.bookingDrafts.createOrUpdateInternal, {
      name: "Multi Vehicle",
      email: "multi@example.com",
      phone: "555-0199",
      address: {
        street: "100 Main St",
        city: "Little Rock",
        state: "AR",
        zip: "72201",
      },
      vehicles: [
        {
          year: 2022,
          make: "Honda",
          model: "Civic",
          size: "small",
          serviceIds: [service1Id],
        },
        {
          year: 2023,
          make: "Ford",
          model: "F-150",
          size: "large",
          serviceIds: [service2Id],
        },
      ],
      serviceIds: [service1Id, service2Id],
      scheduledDate: "2026-08-03",
      scheduledTime: "10:00",
      travelDistanceMiles: 0,
    });

    const schedulingDuration = await t.query(
      internal.bookingDrafts.getSchedulingDurationInternal,
      { draftId: draft.draftId },
    );

    // Vehicle 1 has 60 min, Vehicle 2 has 30 min => sum = 90 min.
    // BOOKING_BLOCK_MINUTES is 120, so max(90, 120) = 120.
    // If it was double-counted (all services for all vehicles): (60+30) * 2 = 180 min.
    expect(schedulingDuration).toBe(120);
  });
});
