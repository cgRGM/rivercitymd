import { describe, expect, test } from "vitest";
import {
  getPostVerificationRedirectPath,
  getProtectedRouteRedirect,
  getRoleHomePath,
} from "./auth-routing";

describe("auth routing helpers", () => {
  test("routes admins to setup when booking readiness is incomplete", () => {
    expect(getRoleHomePath("admin", false)).toBe("/admin/settings?setup=required");
    expect(
      getProtectedRouteRedirect({
        pathname: "/dashboard",
        role: "admin",
        isSetupReady: false,
      }),
    ).toBe("/admin/settings?setup=required");
  });

  test("keeps clients out of admin routes", () => {
    expect(
      getProtectedRouteRedirect({
        pathname: "/admin/payments",
        role: "client",
      }),
    ).toBe("/dashboard");
    expect(
      getProtectedRouteRedirect({
        pathname: "/dashboard/appointments",
        role: "client",
      }),
    ).toBeNull();
  });

  test("sends invited guests to onboarding until onboarding is complete", () => {
    expect(
      getPostVerificationRedirectPath({
        onboardingComplete: false,
        paymentSuccess: true,
      }),
    ).toBe("/onboarding?payment=success");
    expect(
      getPostVerificationRedirectPath({
        onboardingComplete: true,
        paymentSuccess: true,
      }),
    ).toBe("/dashboard/appointments?payment=success");
  });
});
