import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules, stripeFetchMock } from "./test.setup";

describe("vehicleTypes", () => {
  afterEach(() => {
    vi.stubGlobal("fetch", vi.fn(stripeFetchMock));
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_VEHICLE_CLASSIFIER_MODEL;
  });

  test("seeds default vehicle types", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-vehicle-types@test.com",
        role: "admin",
      });
    });
    const asAdmin = t.withIdentity({
      subject: adminId,
      email: "admin-vehicle-types@test.com",
    });

    await asAdmin.mutation(api.vehicleTypes.ensureDefaults, {});

    const vehicleTypes = await asAdmin.query(api.vehicleTypes.list, {});
    expect(vehicleTypes.map((vehicleType) => vehicleType.name)).toEqual([
      "Car",
      "Truck",
      "SUV",
      "Van",
      "Motorcycle",
    ]);
  });

  test("classifies minivans from FuelEconomy as Van", async () => {
    const t = convexTest(schema, modules);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = String(url);
        if (urlString.includes("/menu/options")) {
          return Response.json({ menuItem: { value: "12345" } });
        }
        if (urlString.includes("/ws/rest/vehicle/12345")) {
          return Response.json({ VClass: "Minivan - 2WD" });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const result = await t.action(api.vehicleTypes.classify, {
      year: 2024,
      make: "Honda",
      model: "Odyssey",
    });

    expect(result.vehicleTypeName).toBe("Van");
    expect(result.legacySize).toBe("large");
    expect(result.source).toBe("fuelEconomy");
    expect(result.confidence).toBe("high");
    expect(result.needsAdminReview).toBe(false);
  });

  test("searches FuelEconomy vehicle models by year and typed make/model", async () => {
    const t = convexTest(schema, modules);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = String(url);
        if (urlString.includes("/menu/make")) {
          return Response.json({
            menuItem: [
              { text: "Kia", value: "Kia" },
              { text: "Toyota", value: "Toyota" },
            ],
          });
        }
        if (urlString.includes("/menu/model")) {
          return Response.json({
            menuItem: [
              { text: "Sorento", value: "Sorento" },
              { text: "Sportage", value: "Sportage" },
            ],
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const results = await t.action(api.vehicleTypes.searchModels, {
      query: "2024 kia sor",
    });

    expect(results).toEqual([
      {
        year: 2024,
        make: "Kia",
        model: "Sorento",
        label: "2024 Kia Sorento",
        source: "fuelEconomy",
      },
    ]);
  });

  test("searches recent FuelEconomy model years when the year is omitted", async () => {
    const t = convexTest(schema, modules);
    const newestYear = new Date().getFullYear() + 1;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = String(url);
        if (urlString.includes("/menu/make")) {
          return Response.json({
            menuItem: [{ text: "Kia", value: "Kia" }],
          });
        }
        if (urlString.includes("/menu/model")) {
          return Response.json({
            menuItem: [{ text: "Sorento AWD", value: "Sorento AWD" }],
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const results = await t.action(api.vehicleTypes.searchModels, {
      query: "Kia Sorento",
    });

    expect(results[0]).toEqual({
      year: newestYear,
      make: "Kia",
      model: "Sorento AWD",
      label: `${newestYear} Kia Sorento AWD`,
      source: "fuelEconomy",
    });
    expect(results).toHaveLength(8);
  });

  test("searches vehicles when only make is specified (year and model omitted)", async () => {
    const t = convexTest(schema, modules);
    const newestYear = new Date().getFullYear() + 1;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = String(url);
        if (urlString.includes("/menu/make")) {
          return Response.json({
            menuItem: [{ text: "Kia", value: "Kia" }],
          });
        }
        if (urlString.includes("/menu/model")) {
          return Response.json({
            menuItem: [
              { text: "Sorento AWD", value: "Sorento AWD" },
              { text: "Sportage", value: "Sportage" },
            ],
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const results = await t.action(api.vehicleTypes.searchModels, {
      query: "Kia",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toEqual({
      year: newestYear,
      make: "Kia",
      model: "Sorento AWD",
      label: `${newestYear} Kia Sorento AWD`,
      source: "fuelEconomy",
    });
    expect(results[1]).toEqual({
      year: newestYear,
      make: "Kia",
      model: "Sportage",
      label: `${newestYear} Kia Sportage`,
      source: "fuelEconomy",
    });
  });

  test("falls back to vPIC when FuelEconomy lookup fails", async () => {
    const t = convexTest(schema, modules);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = String(url);
        if (urlString.includes("fueleconomy.gov")) {
          return Response.json({}, { status: 500 });
        }
        if (urlString.includes("vpic.nhtsa.dot.gov")) {
          return Response.json({
            Results: [
              {
                Model_Name: "F-150",
                VehicleTypeName: "Truck",
              },
            ],
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const result = await t.action(api.vehicleTypes.classify, {
      year: 2024,
      make: "Ford",
      model: "F-150",
    });

    expect(result.vehicleTypeName).toBe("Truck");
    expect(result.legacySize).toBe("large");
    expect(result.source).toBe("vpic");
    expect(result.confidence).toBe("high");
    expect(result.needsAdminReview).toBe(false);
  });

  test("matches vPIC models when drivetrain suffixes differ", async () => {
    const t = convexTest(schema, modules);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const urlString = String(url);
        if (urlString.includes("fueleconomy.gov")) {
          return Response.json({}, { status: 500 });
        }
        if (urlString.includes("vpic.nhtsa.dot.gov")) {
          return Response.json({
            Results: [
              {
                Model_Name: "Sorento",
                VehicleTypeName: "Sport Utility Vehicle",
              },
            ],
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const result = await t.action(api.vehicleTypes.classify, {
      year: 2012,
      make: "Kia",
      model: "Sorento AWD",
    });

    expect(result.vehicleTypeName).toBe("SUV");
    expect(result.legacySize).toBe("large");
    expect(result.source).toBe("vpic");
    expect(result.needsAdminReview).toBe(false);
  });

  test("uses Gemini Search as a final classifier for oddball manual vehicles", async () => {
    const t = convexTest(schema, modules);
    process.env.GEMINI_API_KEY = "gemini_test_key";
    process.env.GEMINI_VEHICLE_CLASSIFIER_MODEL = "gemini-test-model";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, options?: RequestInit) => {
        const urlString = String(url);
        if (urlString.includes("fueleconomy.gov")) {
          return Response.json({}, { status: 500 });
        }
        if (urlString.includes("vpic.nhtsa.dot.gov")) {
          return Response.json({ Results: [] });
        }
        if (urlString.includes("generativelanguage.googleapis.com")) {
          expect(options?.body?.toString()).toContain("google_search");
          return Response.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        slug: "motorcycle",
                        confidence: "high",
                        rawCategory: "three-wheeled motorcycle / roadster",
                      }),
                    },
                  ],
                },
              },
            ],
          });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const result = await t.action(api.vehicleTypes.classify, {
      year: 2024,
      make: "Can-Am",
      model: "Spyder RT",
    });

    expect(result.vehicleTypeName).toBe("Motorcycle");
    expect(result.legacySize).toBe("small");
    expect(result.confidence).toBe("high");
    expect(result.rawCategory).toContain("Gemini Search");
    expect(result.needsAdminReview).toBe(false);
  });

  test("does not assign Car pricing when classification confidence is low", async () => {
    const t = convexTest(schema, modules);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 404 })),
    );

    const result = await t.action(api.vehicleTypes.classify, {
      year: 2024,
      make: "Unknown",
      model: "Mystery Vehicle",
    });

    expect(result.vehicleTypeId).toBeUndefined();
    expect(result.vehicleTypeName).toBeUndefined();
    expect(result.confidence).toBe("low");
    expect(result.needsAdminReview).toBe(true);
  });
});
