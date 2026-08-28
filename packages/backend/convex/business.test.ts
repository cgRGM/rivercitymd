import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("business", () => {
  test("get returns null when no business info", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.business.get);
    expect(result).toBeNull();
  });

  test("get returns business info when present", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("businessInfo", {
        name: "River City Mobile Detailing",
        owner: "Jane Doe",
        address: "123 Main St",
        cityStateZip: "Little Rock, AR 72201",
        country: "USA",
      });
    });

    const result = await t.query(api.business.get);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("River City Mobile Detailing");
    expect(result?.owner).toBe("Jane Doe");
    expect(result?.address).toBe("123 Main St");
    expect(result?.country).toBe("USA");
  });
});
