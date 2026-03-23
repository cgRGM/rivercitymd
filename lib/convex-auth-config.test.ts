import { afterEach, describe, expect, test, vi } from "vitest";

const originalFrontendApiUrl = process.env.CLERK_FRONTEND_API_URL;
const originalJwtIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();

  if (originalFrontendApiUrl === undefined) {
    delete process.env.CLERK_FRONTEND_API_URL;
  } else {
    process.env.CLERK_FRONTEND_API_URL = originalFrontendApiUrl;
  }

  if (originalJwtIssuerDomain === undefined) {
    delete process.env.CLERK_JWT_ISSUER_DOMAIN;
  } else {
    process.env.CLERK_JWT_ISSUER_DOMAIN = originalJwtIssuerDomain;
  }
});

describe("convex auth config", () => {
  test("exports no providers when Clerk env is missing", async () => {
    delete process.env.CLERK_FRONTEND_API_URL;
    delete process.env.CLERK_JWT_ISSUER_DOMAIN;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    const config = await import("../convex/auth.config");

    expect(config.default.providers).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  test("exports Clerk provider when issuer env is configured", async () => {
    process.env.CLERK_FRONTEND_API_URL = "https://clerk.example.com";
    delete process.env.CLERK_JWT_ISSUER_DOMAIN;

    vi.resetModules();
    const config = await import("../convex/auth.config");

    expect(config.default.providers).toEqual([
      {
        domain: "https://clerk.example.com",
        applicationID: "convex",
      },
    ]);
  });
});
