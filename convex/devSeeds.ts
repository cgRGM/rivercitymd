import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";

type VehicleSeed = {
  name: string;
  slug: string;
  legacySize: "small" | "medium" | "large";
  displayOrder: number;
  apiAliases: string[];
};

type ServiceSeed = {
  name: string;
  description: string;
  duration: number;
  categorySlug: string;
  serviceType: "standard" | "addon";
  bookingRole: "core" | "upgrade" | "addon";
  features: string[];
  isSubscribable?: boolean;
  disallowWhenPetHair?: boolean;
  disallowWhenDirtyMud?: boolean;
  prices: Record<string, { price: number; duration: number }>;
};

const vehicles: VehicleSeed[] = [
  {
    name: "Car",
    slug: "car",
    legacySize: "medium",
    displayOrder: 10,
    apiAliases: ["car", "compact", "subcompact", "midsize", "large cars", "sedan"],
  },
  {
    name: "Truck",
    slug: "truck",
    legacySize: "large",
    displayOrder: 20,
    apiAliases: ["pickup", "truck"],
  },
  {
    name: "SUV",
    slug: "suv",
    legacySize: "large",
    displayOrder: 30,
    apiAliases: ["sport utility", "suv"],
  },
  {
    name: "Van",
    slug: "van",
    legacySize: "large",
    displayOrder: 40,
    apiAliases: ["van", "minivan", "special purpose vehicle"],
  },
  {
    name: "Motorcycle",
    slug: "motorcycle",
    legacySize: "small",
    displayOrder: 50,
    apiAliases: ["motorcycle", "scooter"],
  },
  {
    name: "Scooter",
    slug: "scooter",
    legacySize: "medium",
    displayOrder: 60,
    apiAliases: ["scooter"],
  },
  {
    name: "Standard Bike",
    slug: "standard-bike",
    legacySize: "small",
    displayOrder: 70,
    apiAliases: ["standard bike"],
  },
  {
    name: "Large Motorcycle",
    slug: "large-motorcycle",
    legacySize: "small",
    displayOrder: 80,
    apiAliases: ["large motorcycle"],
  },
  {
    name: "Side-by-side",
    slug: "side-by-side",
    legacySize: "medium",
    displayOrder: 90,
    apiAliases: ["side-by-side"],
  },
  {
    name: "Small Trailer",
    slug: "small-trailer",
    legacySize: "medium",
    displayOrder: 100,
    apiAliases: ["small trailer"],
  },
];

const categories = [
  { name: "Full Detail", slug: "full-detail", type: "standard" as const, displayOrder: 10 },
  { name: "Interior", slug: "interior", type: "standard" as const, displayOrder: 20 },
  { name: "Exterior", slug: "exterior", type: "standard" as const, displayOrder: 30 },
  { name: "Wax & Ceramic", slug: "wax-ceramic", type: "standard" as const, displayOrder: 40 },
  { name: "Add-ons", slug: "add-ons", type: "addon" as const, displayOrder: 50 },
];

const services: ServiceSeed[] = [
  {
    name: "Level 1 - Basic Reset",
    description: "Maintenance reset for vehicles that need a light interior and exterior refresh.",
    duration: 60,
    categorySlug: "full-detail",
    serviceType: "standard",
    bookingRole: "core",
    features: ["Contact wash", "Interior vacuum", "Dash wipe-down"],
    isSubscribable: true,
    disallowWhenPetHair: true,
    disallowWhenDirtyMud: true,
    prices: {
      car: { price: 110, duration: 60 },
      truck: { price: 125, duration: 70 },
      suv: { price: 125, duration: 75 },
      van: { price: 140, duration: 80 },
    },
  },
  {
    name: "Level 2 - Express Detail",
    description: "Express full detail with deeper cleaning for regular upkeep.",
    duration: 110,
    categorySlug: "full-detail",
    serviceType: "standard",
    bookingRole: "core",
    features: ["Exterior wash", "Interior detail", "Door jambs", "Tire dressing"],
    isSubscribable: true,
    prices: {
      car: { price: 150, duration: 100 },
      truck: { price: 170, duration: 120 },
      suv: { price: 170, duration: 110 },
      van: { price: 200, duration: 140 },
    },
  },
  {
    name: "Level 3 - Full Detail",
    description: "Complete detail for vehicles needing a full reset inside and out.",
    duration: 190,
    categorySlug: "full-detail",
    serviceType: "standard",
    bookingRole: "core",
    features: ["Deep clean", "Interior shampoo", "Exterior decon", "Protection"],
    isSubscribable: true,
    prices: {
      car: { price: 300, duration: 180 },
      truck: { price: 325, duration: 200 },
      suv: { price: 325, duration: 190 },
      van: { price: 380, duration: 210 },
    },
  },
  {
    name: "Level 1 - Interior Detail",
    description: "Basic interior service for lightly used vehicles.",
    duration: 60,
    categorySlug: "interior",
    serviceType: "standard",
    bookingRole: "core",
    features: ["Vacuum", "Windows", "Dash wipe-down"],
    isSubscribable: true,
    disallowWhenPetHair: true,
    prices: {
      car: { price: 75, duration: 60 },
      truck: { price: 90, duration: 70 },
      suv: { price: 90, duration: 70 },
      van: { price: 110, duration: 75 },
    },
  },
  {
    name: "Level 2 - Interior Detail",
    description: "Deeper interior cleaning for seats, carpets, and panels.",
    duration: 105,
    categorySlug: "interior",
    serviceType: "standard",
    bookingRole: "core",
    features: ["Seat cleaning", "Carpet cleaning", "Panel deep clean"],
    isSubscribable: true,
    prices: {
      car: { price: 150, duration: 100 },
      truck: { price: 175, duration: 105 },
      suv: { price: 175, duration: 105 },
      van: { price: 200, duration: 110 },
    },
  },
  {
    name: "Exterior Maintenance Wash",
    description: "Exterior hand wash for routine upkeep.",
    duration: 60,
    categorySlug: "exterior",
    serviceType: "standard",
    bookingRole: "core",
    features: ["Hand wash", "Wheels", "Tires", "Drying"],
    isSubscribable: true,
    prices: {
      car: { price: 80, duration: 50 },
      truck: { price: 90, duration: 60 },
      suv: { price: 90, duration: 60 },
      van: { price: 100, duration: 60 },
    },
  },
  {
    name: "Wash Clay Seal",
    description: "Exterior wash, clay treatment, and sealant protection.",
    duration: 100,
    categorySlug: "wax-ceramic",
    serviceType: "standard",
    bookingRole: "upgrade",
    features: ["Clay treatment", "Sealant", "Gloss boost"],
    prices: {
      car: { price: 175, duration: 90 },
      truck: { price: 200, duration: 100 },
      suv: { price: 200, duration: 100 },
      van: { price: 225, duration: 110 },
    },
  },
  {
    name: "5 year ceramic coating",
    description: "Long-term ceramic protection package.",
    duration: 360,
    categorySlug: "wax-ceramic",
    serviceType: "standard",
    bookingRole: "upgrade",
    features: ["Paint prep", "Ceramic coating", "Long-term protection"],
    prices: {
      car: { price: 700, duration: 360 },
      truck: { price: 800, duration: 420 },
      suv: { price: 800, duration: 420 },
    },
  },
  {
    name: "Motorcycle full detail",
    description: "Full detail package for motorcycles and scooters.",
    duration: 135,
    categorySlug: "full-detail",
    serviceType: "standard",
    bookingRole: "core",
    features: ["Foam wash", "Wheel cleaning", "Blow dry"],
    isSubscribable: true,
    prices: {
      scooter: { price: 175, duration: 120 },
      "standard-bike": { price: 200, duration: 135 },
      "large-motorcycle": { price: 225, duration: 150 },
    },
  },
  {
    name: "Leather Refresh",
    description: "Leather cleaning and conditioning.",
    duration: 30,
    categorySlug: "add-ons",
    serviceType: "addon",
    bookingRole: "addon",
    features: ["Clean leather", "Condition surfaces"],
    prices: {
      car: { price: 50, duration: 30 },
      truck: { price: 60, duration: 30 },
      suv: { price: 60, duration: 30 },
      van: { price: 70, duration: 35 },
    },
  },
  {
    name: "Headlight Restoration",
    description: "Wet sand, polish, and UV seal cloudy headlights.",
    duration: 60,
    categorySlug: "add-ons",
    serviceType: "addon",
    bookingRole: "addon",
    features: ["Polish", "UV seal"],
    prices: {
      car: { price: 100, duration: 60 },
      truck: { price: 100, duration: 60 },
      suv: { price: 100, duration: 60 },
      van: { price: 100, duration: 60 },
    },
  },
];

export const seedServiceCatalog = mutation({
  args: {
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.confirm !== "seed-service-catalog") {
      throw new Error("Pass confirm: seed-service-catalog to seed dev data.");
    }

    const now = Date.now();
    const vehicleIds = new Map<string, Id<"vehicleTypes">>();
    for (const vehicle of vehicles) {
      const existing = await ctx.db
        .query("vehicleTypes")
        .withIndex("by_slug", (q) => q.eq("slug", vehicle.slug))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...vehicle, isActive: true, updatedAt: now });
        vehicleIds.set(vehicle.slug, existing._id);
      } else {
        const id = await ctx.db.insert("vehicleTypes", {
          ...vehicle,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        vehicleIds.set(vehicle.slug, id);
      }
    }

    const categoryIds = new Map<string, Id<"serviceCategories">>();
    const existingCategories = await ctx.db.query("serviceCategories").collect();
    for (const category of categories) {
      const existing = existingCategories.find(
        (candidate) => candidate.slug === category.slug || candidate.name === category.name,
      );
      if (existing) {
        await ctx.db.patch(existing._id, category);
        categoryIds.set(category.slug, existing._id);
      } else {
        const id = await ctx.db.insert("serviceCategories", category);
        categoryIds.set(category.slug, id);
      }
    }

    const allServices = await ctx.db.query("services").collect();
    let servicesUpserted = 0;
    let pricesInserted = 0;
    for (const service of services) {
      const categoryId = categoryIds.get(service.categorySlug);
      const servicePrices = Object.values(service.prices).map((price) => price.price);
      const compatibilityPrice = servicePrices[0] ?? 0;
      const existing = allServices.find((candidate) => candidate.name === service.name);
      const servicePatch = {
        name: service.name,
        description: service.description,
        basePrice: compatibilityPrice,
        basePriceSmall: compatibilityPrice,
        basePriceMedium: compatibilityPrice,
        basePriceLarge: compatibilityPrice,
        duration: service.duration,
        serviceType: service.serviceType,
        bookingRole: service.bookingRole,
        isSubscribable: service.isSubscribable ?? false,
        subscriptionFrequencies:
          service.isSubscribable === true
            ? (["monthly", "biweekly"] as Array<"monthly" | "biweekly">)
            : ([] as Array<"monthly" | "biweekly">),
        disallowWhenPetHair: service.disallowWhenPetHair ?? false,
        disallowWhenDirtyMud: service.disallowWhenDirtyMud ?? false,
        categoryId,
        includedServiceIds: [],
        isActive: true,
        showOnLandingPage: true,
        features: service.features,
      };
      const serviceId = existing
        ? existing._id
        : await ctx.db.insert("services", servicePatch);
      if (existing) {
        await ctx.db.patch(existing._id, servicePatch);
      }
      servicesUpserted += 1;

      const existingPrices = await ctx.db
        .query("serviceVehiclePrices")
        .withIndex("by_service", (q) => q.eq("serviceId", serviceId))
        .collect();
      await Promise.all(
        existingPrices.map((price: Doc<"serviceVehiclePrices">) =>
          ctx.db.delete(price._id),
        ),
      );

      for (const [vehicleSlug, price] of Object.entries(service.prices)) {
        const vehicleTypeId = vehicleIds.get(vehicleSlug);
        if (!vehicleTypeId) continue;
        await ctx.db.insert("serviceVehiclePrices", {
          serviceId,
          vehicleTypeId,
          price: price.price,
          duration: price.duration,
          isAvailable: true,
          createdAt: now,
          updatedAt: now,
        });
        pricesInserted += 1;
      }
    }

    return {
      vehicleTypes: vehicleIds.size,
      categories: categoryIds.size,
      services: servicesUpserted,
      serviceVehiclePrices: pricesInserted,
    };
  },
});
