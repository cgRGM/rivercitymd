import {
  query,
  mutation,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getUserIdFromIdentity, requireAdmin } from "./auth";
import { internal } from "./_generated/api";
import {
  hasAnyAvailableVehicleTypePrice,
  hasAnyPositiveServicePrice,
  normalizeServiceType,
  type VehicleSize,
} from "./lib/pricing";

const SERVICE_TYPE_LABELS = {
  standard: "Standard Services",
  addon: "Add-on Services",
  subscription: "Subscription Plans",
} as const;

const LANDING_PAGE_SERVICE_LIMIT = 5;

type LandingPageService = {
  _id: Id<"services">;
  name: string;
  description: string;
  icon?: string;
  features?: string[];
  price: number;
  duration: number;
};

type LandingPageVehicleGroup = {
  vehicleType: Doc<"vehicleTypes">;
  services: LandingPageService[];
};

function assertHasPositivePrice(args: {
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  basePrice?: number;
  vehiclePrices?: Array<{
    price: number;
    duration?: number;
    isAvailable: boolean;
  }>;
}) {
  if (!hasAnyPositiveServicePrice(args) && !hasAnyAvailableVehicleTypePrice(args.vehiclePrices)) {
    throw new ConvexError({
      code: "INVALID_SERVICE_PRICING",
      message: "At least one vehicle type price must be available and greater than $0.",
    });
  }
}

const vehiclePriceInputValidator = v.object({
  vehicleTypeId: v.optional(v.id("vehicleTypes")),
  vehicleTypeName: v.optional(v.string()),
  price: v.number(),
  duration: v.number(),
  isAvailable: v.boolean(),
});

type VehiclePriceInput = {
  vehicleTypeId?: Id<"vehicleTypes">;
  vehicleTypeName?: string;
  price: number;
  duration: number;
  isAvailable: boolean;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferLegacySize(name: string): VehicleSize {
  const normalized = name.toLowerCase();
  if (normalized.includes("motorcycle") || normalized.includes("bike")) {
    return "small";
  }
  if (
    normalized.includes("truck") ||
    normalized.includes("van") ||
    normalized.includes("suv")
  ) {
    return "large";
  }
  return "medium";
}

async function ensureVehicleTypeForPrice(ctx: any, price: VehiclePriceInput) {
  if (price.vehicleTypeId) {
    const existing = await ctx.db.get(price.vehicleTypeId);
    if (!existing) throw new Error("Vehicle type not found");
    return existing as Doc<"vehicleTypes">;
  }

  const name = price.vehicleTypeName?.trim();
  if (!name) {
    throw new ConvexError({
      code: "INVALID_SERVICE_PRICING",
      message: "Each pricing row needs a vehicle type.",
    });
  }

  const slug = slugify(name);
  const existing = await ctx.db
    .query("vehicleTypes")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
  if (existing) return existing;

  const now = Date.now();
  const vehicleTypes = await ctx.db.query("vehicleTypes").collect();
  const vehicleTypeId = await ctx.db.insert("vehicleTypes", {
    name,
    slug,
    legacySize: inferLegacySize(name),
    isActive: true,
    displayOrder:
      vehicleTypes.reduce(
        (max: number, vehicleType: Doc<"vehicleTypes">) =>
          Math.max(max, vehicleType.displayOrder),
        0,
      ) + 10,
    apiAliases: [name.toLowerCase()],
    createdAt: now,
    updatedAt: now,
  });

  return await ctx.db.get(vehicleTypeId);
}

async function getServiceVehiclePrices(ctx: any, serviceId: Id<"services">) {
  const prices = await ctx.db
    .query("serviceVehiclePrices")
    .withIndex("by_service", (q: any) => q.eq("serviceId", serviceId))
    .collect();

  const rows = await Promise.all(
    prices.map(async (price: Doc<"serviceVehiclePrices">) => {
      const vehicleType = await ctx.db.get(price.vehicleTypeId);
      return {
        ...price,
        vehicleType,
      };
    }),
  );

  return rows.sort((a, b) => {
    const orderA = a.vehicleType?.displayOrder ?? 999;
    const orderB = b.vehicleType?.displayOrder ?? 999;
    return orderA - orderB || (a.vehicleType?.name ?? "").localeCompare(b.vehicleType?.name ?? "");
  });
}

async function getServiceVehiclePricesForPresentation(
  ctx: any,
  service: Doc<"services">,
) {
  const storedPrices = await getServiceVehiclePrices(ctx, service._id);
  if (storedPrices.length > 0) return storedPrices;

  const vehicleTypes = await ctx.db.query("vehicleTypes").collect();
  const legacyMappings = [
    { slug: "car", price: service.basePriceSmall ?? service.basePrice ?? 0 },
    { slug: "suv", price: service.basePriceMedium ?? service.basePrice ?? 0 },
    { slug: "truck", price: service.basePriceLarge ?? service.basePrice ?? 0 },
  ];

  return legacyMappings.flatMap(({ slug, price }) => {
    const vehicleType = vehicleTypes.find(
      (candidate: Doc<"vehicleTypes">) => candidate.slug === slug && candidate.isActive,
    );
    if (!vehicleType) return [];

    return [
      {
        serviceId: service._id,
        vehicleTypeId: vehicleType._id,
        price,
        duration: service.duration,
        isAvailable: price > 0 && service.duration > 0,
        createdAt: service._creationTime,
        updatedAt: service._creationTime,
        vehicleType,
      },
    ];
  });
}

async function getServiceCategoryName(ctx: any, service: Doc<"services">) {
  if (!service.categoryId) {
    return SERVICE_TYPE_LABELS[normalizeServiceType(service.serviceType)];
  }
  const category = await ctx.db.get(service.categoryId);
  return category?.name ?? SERVICE_TYPE_LABELS[normalizeServiceType(service.serviceType)];
}

function calculateLegacyPrices(
  rows: Array<{
    price: number;
    isAvailable: boolean;
    vehicleType?: Doc<"vehicleTypes"> | null;
  }>,
  fallback: {
    basePriceSmall?: number;
    basePriceMedium?: number;
    basePriceLarge?: number;
  },
) {
  const result = { ...fallback };
  const canonicalMappings = [
    { slug: "car", size: "small" },
    { slug: "suv", size: "medium" },
    { slug: "truck", size: "large" },
  ] as const;

  for (const size of ["small", "medium", "large"] as VehicleSize[]) {
    const canonicalSlug = canonicalMappings.find(
      (mapping) => mapping.size === size,
    )?.slug;
    const matching =
      rows.find(
        (row) =>
          row.isAvailable &&
          row.price > 0 &&
          row.vehicleType?.slug === canonicalSlug,
      ) ??
      rows.find(
        (row) =>
          row.isAvailable &&
          row.price > 0 &&
          !canonicalMappings.some(
            (mapping) => mapping.slug === row.vehicleType?.slug,
          ) &&
          row.vehicleType?.legacySize === size,
      );
    if (matching) {
      if (size === "small") result.basePriceSmall = matching.price;
      if (size === "medium") result.basePriceMedium = matching.price;
      if (size === "large") result.basePriceLarge = matching.price;
    }
  }
  return result;
}

async function replaceServiceVehiclePrices(
  ctx: any,
  serviceId: Id<"services">,
  vehiclePrices: VehiclePriceInput[] | undefined,
) {
  if (!vehiclePrices) return null;

  await ctx.runMutation(internal.vehicleTypes.ensureDefaultsInternal, {});
  const existing = await ctx.db
    .query("serviceVehiclePrices")
    .withIndex("by_service", (q: any) => q.eq("serviceId", serviceId))
    .collect();
  await Promise.all(existing.map((row: Doc<"serviceVehiclePrices">) => ctx.db.delete(row._id)));

  const now = Date.now();
  const seen = new Set<string>();
  const rows = [];
  for (const input of vehiclePrices) {
    const vehicleType = await ensureVehicleTypeForPrice(ctx, input);
    if (!vehicleType || seen.has(vehicleType._id)) continue;
    seen.add(vehicleType._id);
    const price = Math.max(0, input.price || 0);
    const duration = Math.max(0, Math.floor(input.duration || 0));
    const isAvailable = input.isAvailable && price > 0 && duration > 0;

    const rowId = await ctx.db.insert("serviceVehiclePrices", {
      serviceId,
      vehicleTypeId: vehicleType._id,
      price,
      duration,
      isAvailable,
      createdAt: now,
      updatedAt: now,
    });
    const row = await ctx.db.get(rowId);
    rows.push({ ...row, vehicleType });
  }

  return rows;
}

async function createStripeProductForService(ctx: any, serviceId: Id<"services">) {
  // Get the service data
  const service = await ctx.runQuery(internal.services.getServiceById, {
    serviceId,
  });
  const vehiclePrices = await ctx.runQuery(
    internal.services.getVehiclePricesByServiceId,
    { serviceId },
  );

  if (!service) throw new Error("Service not found");
  if (service.stripeProductId) {
    await updateStripeProductForService(ctx, serviceId);
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    // No-op when Stripe key is missing (e.g. test env) to avoid writes after test transaction
    console.warn(
      "STRIPE_SECRET_KEY not set, skipping createStripeProduct for service",
      serviceId,
    );
    return;
  }

  const serviceType = normalizeServiceType(service.serviceType);
  const productBody = new URLSearchParams({
    name: service.name,
    description: service.description || "",
    "metadata[serviceId]": serviceId,
    "metadata[serviceType]": serviceType,
  });
  if (service.categoryId) {
    productBody.append("metadata[categoryId]", service.categoryId);
  }

  // Create Stripe product using HTTP fetch (no SDK)
  const productResponse = await fetch("https://api.stripe.com/v1/products", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: productBody,
  });

  if (!productResponse.ok) {
    const errorText = await productResponse.text();
    throw new Error(
      `Stripe product creation failed: ${productResponse.status} ${errorText}`,
    );
  }

  const product = await productResponse.json();

  // Create prices for each vehicle type when the matrix exists; otherwise keep
  // the legacy size prices for backwards compatibility.
  const prices = [];
  const availableVehiclePrices = vehiclePrices.filter(
    (row: Doc<"serviceVehiclePrices">) => row.isAvailable && row.price > 0,
  );

  if (availableVehiclePrices.length > 0) {
    for (const row of availableVehiclePrices) {
      const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          product: product.id,
          unit_amount: Math.round(row.price * 100).toString(),
          currency: "usd",
          "metadata[serviceId]": serviceId,
          "metadata[serviceVehiclePriceId]": row._id,
          "metadata[vehicleTypeId]": row.vehicleTypeId,
        }),
      });

      if (!priceResponse.ok) {
        const errorText = await priceResponse.text();
        throw new Error(
          `Stripe vehicle type price creation failed: ${priceResponse.status} ${errorText}`,
        );
      }

      const price = await priceResponse.json();
      prices.push(price);
      await ctx.runMutation(internal.services.updateServiceVehicleStripePriceId, {
        serviceVehiclePriceId: row._id,
        stripePriceId: price.id,
      });
    }
  }

  if (availableVehiclePrices.length === 0 && service.basePriceSmall && service.basePriceSmall > 0) {
    const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: Math.round(service.basePriceSmall * 100).toString(),
        currency: "usd",
        "metadata[serviceId]": serviceId,
        "metadata[vehicleSize]": "small",
      }),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      throw new Error(
        `Stripe small price creation failed: ${priceResponse.status} ${errorText}`,
      );
    }

    const price = await priceResponse.json();
    prices.push(price);
  }

  if (availableVehiclePrices.length === 0 && service.basePriceMedium && service.basePriceMedium > 0) {
    const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: Math.round(service.basePriceMedium * 100).toString(),
        currency: "usd",
        "metadata[serviceId]": serviceId,
        "metadata[vehicleSize]": "medium",
      }),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      throw new Error(
        `Stripe medium price creation failed: ${priceResponse.status} ${errorText}`,
      );
    }

    const price = await priceResponse.json();
    prices.push(price);
  }

  if (availableVehiclePrices.length === 0 && service.basePriceLarge && service.basePriceLarge > 0) {
    const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: Math.round(service.basePriceLarge * 100).toString(),
        currency: "usd",
        "metadata[serviceId]": serviceId,
        "metadata[vehicleSize]": "large",
      }),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      throw new Error(
        `Stripe large price creation failed: ${priceResponse.status} ${errorText}`,
      );
    }

    const price = await priceResponse.json();
    prices.push(price);
  }

  // Update service with Stripe product ID and price IDs
  // Note: Deposit is now a separate product managed via depositSettings
  await ctx.runMutation(internal.services.updateStripeIds, {
    serviceId,
    stripeProductId: product.id,
    stripePriceIds: prices.map((p) => p.id),
  });
}

async function updateStripeProductForService(ctx: any, serviceId: Id<"services">) {
  const service = await ctx.runQuery(internal.services.getServiceById, {
    serviceId,
  });

  if (!service) throw new Error("Service not found");
  if (!service.stripeProductId) throw new Error("Service has no Stripe product");

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    // No-op when Stripe key is missing (e.g. test env) to avoid scheduled action failures
    console.warn(
      "STRIPE_SECRET_KEY not set, skipping updateStripeProduct for service",
      serviceId,
    );
    return service.stripeProductId;
  }

  const updateResponse = await fetch(
    `https://api.stripe.com/v1/products/${service.stripeProductId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        name: service.name,
        description: service.description || "",
        active: service.isActive ? "true" : "false",
      }),
    },
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(
      `Stripe product update failed: ${updateResponse.status} ${errorText}`,
    );
  }

  return service.stripeProductId;
}

// === Legacy Categories ===

// List legacy service categories
export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("serviceCategories").collect();
  },
});

// Create a legacy service category
export const createCategory = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("standard"),
      v.literal("subscription"),
      v.literal("addon"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await ctx.db.insert("serviceCategories", {
      name: args.name,
      type: args.type,
    });
  },
});

// === Services ===

// Create Stripe product for service (action for external API calls)
export const createStripeProduct = action({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await createStripeProductForService(ctx, args.serviceId);
  },
});

export const createStripeProductInternal = internalAction({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    await createStripeProductForService(ctx, args.serviceId);
  },
});

// Get all services with a display label for compatibility
export const listWithCategories = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();

    return await Promise.all(
      services.map(async (service) => ({
        ...service,
        serviceType: normalizeServiceType(service.serviceType),
        categoryName: await getServiceCategoryName(ctx, service),
        vehiclePrices: await getServiceVehiclePricesForPresentation(ctx, service),
      })),
    );
  },
});

// List all services (simple list)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();
    return await Promise.all(
      services.map(async (service) => ({
        ...service,
        serviceType: normalizeServiceType(service.serviceType),
        categoryName: await getServiceCategoryName(ctx, service),
        vehiclePrices: await getServiceVehiclePricesForPresentation(ctx, service),
      })),
    );
  },
});

export const listLandingPagePricing = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();
    const landingServices = services.filter((service) => {
      const serviceType = normalizeServiceType(service.serviceType);
      return (
        service.isActive &&
        service.showOnLandingPage !== false &&
        serviceType === "standard"
      );
    });

    const vehicleTypeMap = new Map<string, LandingPageVehicleGroup>();

    for (const service of landingServices) {
      const vehiclePrices = await getServiceVehiclePricesForPresentation(ctx, service);
      for (const price of vehiclePrices) {
        if (!price.isAvailable || price.price <= 0 || !price.vehicleType?.isActive) {
          continue;
        }

        const vehicleTypeId = String(price.vehicleTypeId);
        const existing: LandingPageVehicleGroup = vehicleTypeMap.get(vehicleTypeId) ?? {
          vehicleType: price.vehicleType,
          services: [],
        };

        existing.services.push({
          _id: service._id,
          name: service.name,
          description: service.description,
          icon: service.icon,
          features: service.features,
          price: price.price,
          duration: price.duration || service.duration,
        });
        vehicleTypeMap.set(vehicleTypeId, existing);
      }
    }

    return Array.from(vehicleTypeMap.values())
      .map((group) => ({
        vehicleType: group.vehicleType,
        services: group.services
          .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
          .slice(0, LANDING_PAGE_SERVICE_LIMIT),
      }))
      .filter((group) => group.services.length > 0)
      .sort(
        (a, b) =>
          a.vehicleType.displayOrder - b.vehicleType.displayOrder ||
          a.vehicleType.name.localeCompare(b.vehicleType.name),
      );
  },
});

// Create a new service or subscription
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    basePriceSmall: v.optional(v.number()),
    basePriceMedium: v.optional(v.number()),
    basePriceLarge: v.optional(v.number()),
    vehiclePrices: v.optional(v.array(vehiclePriceInputValidator)),
    duration: v.number(),
    serviceType: v.optional(
      v.union(
        v.literal("standard"),
        v.literal("subscription"),
        v.literal("addon"),
      ),
    ),
    categoryId: v.optional(v.id("serviceCategories")), // legacy
    includedServiceIds: v.optional(v.array(v.id("services"))),
    features: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    showOnLandingPage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertHasPositivePrice(args);

    // Calculate basePrice for backwards compatibility (use medium if available)
    const basePrice =
      args.basePriceMedium || args.basePriceSmall || args.basePriceLarge || 0;

    // Create the service in the database
    // Note: Deposit is now a separate product managed via depositSettings
    const serviceId = await ctx.db.insert("services", {
      name: args.name,
      description: args.description,
      basePrice, // For backwards compatibility
      basePriceSmall: args.basePriceSmall,
      basePriceMedium: args.basePriceMedium,
      basePriceLarge: args.basePriceLarge,
      duration: args.duration,
      serviceType: normalizeServiceType(args.serviceType),
      categoryId: args.categoryId,
      includedServiceIds: args.includedServiceIds,
      features: args.features,
      icon: args.icon,
      isActive: true,
      showOnLandingPage: args.showOnLandingPage ?? true,
    });

    const rows = await replaceServiceVehiclePrices(
      ctx,
      serviceId,
      args.vehiclePrices,
    );
    if (rows) {
      const legacyPrices = calculateLegacyPrices(rows, {
        basePriceSmall: args.basePriceSmall,
        basePriceMedium: args.basePriceMedium,
        basePriceLarge: args.basePriceLarge,
      });
      const legacyDuration = args.duration;
      await ctx.db.patch(serviceId, {
        ...legacyPrices,
        basePrice:
          legacyPrices.basePriceMedium ??
          legacyPrices.basePriceSmall ??
          legacyPrices.basePriceLarge ??
          0,
        duration: legacyDuration,
      });
    }

    // Schedule Stripe product creation (async, external API)
    await ctx.scheduler.runAfter(
      0,
      internal.services.createStripeProductInternal,
      {
        serviceId,
      },
    );

    return serviceId;
  },
});

// Update a service or subscription
export const update = mutation({
  args: {
    serviceId: v.id("services"),
    name: v.string(),
    description: v.string(),
    basePriceSmall: v.optional(v.number()),
    basePriceMedium: v.optional(v.number()),
    basePriceLarge: v.optional(v.number()),
    vehiclePrices: v.optional(v.array(vehiclePriceInputValidator)),
    duration: v.number(),
    serviceType: v.optional(
      v.union(
        v.literal("standard"),
        v.literal("subscription"),
        v.literal("addon"),
      ),
    ),
    categoryId: v.optional(v.id("serviceCategories")), // legacy
    includedServiceIds: v.optional(v.array(v.id("services"))),
    features: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
    showOnLandingPage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { serviceId, ...updates } = args;
    const existingService = await ctx.db.get(serviceId);
    if (!existingService) throw new Error("Service not found");
    assertHasPositivePrice(updates);

    // Calculate basePrice for backwards compatibility
    const basePrice =
      updates.basePriceMedium ||
      updates.basePriceSmall ||
      updates.basePriceLarge ||
      0;
    const rows = await replaceServiceVehiclePrices(
      ctx,
      serviceId,
      updates.vehiclePrices,
    );
    const legacyPrices = rows
      ? calculateLegacyPrices(rows, {
          basePriceSmall: updates.basePriceSmall,
          basePriceMedium: updates.basePriceMedium,
          basePriceLarge: updates.basePriceLarge,
        })
      : {
          basePriceSmall: updates.basePriceSmall,
          basePriceMedium: updates.basePriceMedium,
          basePriceLarge: updates.basePriceLarge,
        };
    const legacyDuration = updates.duration;

    await ctx.db.patch(serviceId, {
      name: updates.name,
      description: updates.description,
      basePriceSmall: legacyPrices.basePriceSmall,
      basePriceMedium: legacyPrices.basePriceMedium,
      basePriceLarge: legacyPrices.basePriceLarge,
      duration: legacyDuration,
      serviceType: normalizeServiceType(updates.serviceType),
      categoryId: updates.categoryId,
      includedServiceIds: updates.includedServiceIds,
      features: updates.features,
      icon: updates.icon,
      isActive: updates.isActive,
      showOnLandingPage:
        updates.showOnLandingPage ?? existingService.showOnLandingPage ?? true,
      basePrice: rows
        ? legacyPrices.basePriceMedium ??
          legacyPrices.basePriceSmall ??
          legacyPrices.basePriceLarge ??
          0
        : basePrice, // For backwards compatibility
    });

    if (existingService.stripeProductId) {
      await ctx.scheduler.runAfter(0, internal.services.createStripeProductInternal, {
        serviceId,
      });
    }

    return serviceId;
  },
});

// Delete a service
export const deleteService = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Keep historical appointment references intact by preventing hard-deletes
    // once a service has ever been used.
    const appointments = await ctx.db.query("appointments").collect();
    const isUsed = appointments.some((apt) =>
      apt.serviceIds.includes(args.serviceId),
    );

    if (isUsed) {
      throw new Error("Cannot delete service with appointment history. Hide it instead.");
    }

    await ctx.db.delete(args.serviceId);
    return { success: true };
  },
});

// Get services with booking statistics and popularity
export const listWithBookingStats = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();

    // Get this month's appointments
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const appointments = await ctx.db.query("appointments").collect();
    const thisMonth = appointments.filter(
      (a) => new Date(a.scheduledDate) >= firstDayOfMonth,
    );

    return await Promise.all(services.map(async (service) => {
      const bookingCount = thisMonth.filter((a) =>
        a.serviceIds.includes(service._id),
      ).length;

      let popularity = "Low";
      if (bookingCount > 50) popularity = "Very High";
      else if (bookingCount > 30) popularity = "High";
      else if (bookingCount > 10) popularity = "Medium";

      return {
        ...service,
        serviceType: normalizeServiceType(service.serviceType),
        serviceTypeLabel:
          SERVICE_TYPE_LABELS[normalizeServiceType(service.serviceType)],
        vehiclePrices: await getServiceVehiclePricesForPresentation(ctx, service),
        bookings: bookingCount,
        popularity,
      };
    }));
  },
});

// === Stripe Product Management ===

// Update Stripe product when service changes
export const updateStripeProduct = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");
    if (!service.stripeProductId)
      throw new Error("Service has no Stripe product");

    await ctx.scheduler.runAfter(0, internal.services.createStripeProductInternal, {
      serviceId: args.serviceId,
    });

    return service.stripeProductId;
  },
});

// Get service by ID (for edit form)
export const getById = query({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromIdentity(ctx);
    if (!userId) throw new Error("Not authenticated");

    const service = await ctx.db.get(args.serviceId);
    if (!service) return null;
    return {
      ...service,
      serviceType: normalizeServiceType(service.serviceType),
      categoryName: await getServiceCategoryName(ctx, service),
      vehiclePrices: await getServiceVehiclePricesForPresentation(ctx, service),
    };
  },
});

// Get service by ID (internal)
export const getServiceById = internalQuery({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.serviceId);
  },
});

export const getVehiclePricesByServiceId = internalQuery({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("serviceVehiclePrices")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();
  },
});

// Update Stripe IDs (internal)
export const updateStripeIds = internalMutation({
  args: {
    serviceId: v.id("services"),
    stripeProductId: v.string(),
    stripePriceIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serviceId, {
      stripeProductId: args.stripeProductId,
      stripePriceIds: args.stripePriceIds,
    });
  },
});

export const updateServiceVehicleStripePriceId = internalMutation({
  args: {
    serviceVehiclePriceId: v.id("serviceVehiclePrices"),
    stripePriceId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serviceVehiclePriceId, {
      stripePriceId: args.stripePriceId,
      updatedAt: Date.now(),
    });
  },
});

// Update recurring Stripe price IDs (internal)
export const updateStripeRecurringIds = internalMutation({
  args: {
    serviceId: v.id("services"),
    stripeRecurringPriceIds: v.object({
      monthly: v.optional(v.array(v.string())),
      biweekly: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serviceId, {
      stripeRecurringPriceIds: args.stripeRecurringPriceIds,
    });
  },
});

// Ensure recurring prices exist for a service (creates them if missing)
export const ensureRecurringPrices = internalAction({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const service = await ctx.runQuery(internal.services.getServiceById, {
      serviceId: args.serviceId,
    });
    if (!service) throw new Error("Service not found");
    if (!service.stripeProductId) throw new Error("Service has no Stripe product");

    // Already has recurring prices
    if (
      service.stripeRecurringPriceIds?.monthly?.length ||
      service.stripeRecurringPriceIds?.biweekly?.length
    ) {
      return;
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.warn("STRIPE_SECRET_KEY not set, skipping recurring price creation");
      return;
    }

    const sizes: Array<{ key: string; amount: number | undefined }> = [
      { key: "small", amount: service.basePriceSmall },
      { key: "medium", amount: service.basePriceMedium },
      { key: "large", amount: service.basePriceLarge },
    ];

    const monthlyPriceIds: string[] = [];
    const biweeklyPriceIds: string[] = [];

    for (const size of sizes) {
      if (!size.amount || size.amount <= 0) continue;

      // Monthly price
      const monthlyRes = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          product: service.stripeProductId!,
          unit_amount: Math.round(size.amount * 100).toString(),
          currency: "usd",
          "recurring[interval]": "month",
          "metadata[serviceId]": args.serviceId,
          "metadata[vehicleSize]": size.key,
          "metadata[frequency]": "monthly",
        }),
      });
      if (!monthlyRes.ok) {
        const err = await monthlyRes.text();
        throw new Error(`Stripe monthly price creation failed for ${size.key}: ${err}`);
      }
      const monthlyPrice = await monthlyRes.json();
      monthlyPriceIds.push(monthlyPrice.id);

      // Biweekly price (every 2 weeks)
      const biweeklyRes = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          product: service.stripeProductId!,
          unit_amount: Math.round(size.amount * 100).toString(),
          currency: "usd",
          "recurring[interval]": "week",
          "recurring[interval_count]": "2",
          "metadata[serviceId]": args.serviceId,
          "metadata[vehicleSize]": size.key,
          "metadata[frequency]": "biweekly",
        }),
      });
      if (!biweeklyRes.ok) {
        const err = await biweeklyRes.text();
        throw new Error(`Stripe biweekly price creation failed for ${size.key}: ${err}`);
      }
      const biweeklyPrice = await biweeklyRes.json();
      biweeklyPriceIds.push(biweeklyPrice.id);
    }

    await ctx.runMutation(internal.services.updateStripeRecurringIds, {
      serviceId: args.serviceId,
      stripeRecurringPriceIds: {
        monthly: monthlyPriceIds.length > 0 ? monthlyPriceIds : undefined,
        biweekly: biweeklyPriceIds.length > 0 ? biweeklyPriceIds : undefined,
      },
    });
  },
});
