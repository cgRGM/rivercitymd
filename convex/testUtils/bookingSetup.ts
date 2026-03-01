type BookingSetupOptions = {
  includeBookableService?: boolean;
  includeDepositSettings?: boolean;
  availabilityDays?: number[];
};

const DEFAULT_AVAILABILITY_DAYS = [0, 1, 2, 3, 4, 5, 6];

export async function seedBookingSetup(t: any, options: BookingSetupOptions = {}) {
  const {
    includeBookableService = true,
    includeDepositSettings = false,
    availabilityDays = DEFAULT_AVAILABILITY_DAYS,
  } = options;

  return await t.run(async (ctx: any) => {
    await ctx.db.insert("businessInfo", {
      name: "River City Mobile Detailing",
      owner: "Owner Name",
      address: "123 Main St",
      cityStateZip: "Little Rock, AR 72201",
      country: "USA",
    });

    for (const dayOfWeek of availabilityDays) {
      await ctx.db.insert("availability", {
        dayOfWeek,
        startTime: "08:00",
        endTime: "18:00",
        isActive: true,
      });
    }

    let serviceId: Id<"services"> | undefined;
    if (includeBookableService) {
      serviceId = await ctx.db.insert("services", {
        name: "Setup Baseline Service",
        description: "Ensures booking-readiness checks pass in tests.",
        basePrice: 80,
        basePriceMedium: 80,
        duration: 60,
        serviceType: "standard",
        isActive: true,
      });
    }

    if (includeDepositSettings) {
      await ctx.db.insert("depositSettings", {
        amountPerVehicle: 50,
        isActive: true,
      });
    }

    return { serviceId };
  });
}
import type { Id } from "../_generated/dataModel";
