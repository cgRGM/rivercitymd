import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-up",
  "/onboarding",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isCustomerRoute = createRouteMatcher(["/dashboard(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();
  const url = new URL(request.url);

  // Allow public routes
  if (isPublicRoute(request)) {
    return;
  }

  // Redirect unauthenticated users to sign-in
  if (!isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/sign-in");
  }

  // User is authenticated - check their onboarding status and role
  try {
    const token = await convexAuth.getToken();

    // Check detailed onboarding status
    const onboardingStatus = await fetchQuery(
      api.users.getOnboardingStatus,
      {},
      {
        url: process.env.NEXT_PUBLIC_CONVEX_URL!,
        token: token,
      },
    );

    // If onboarding not complete, redirect to specific step
    if (!onboardingStatus.isComplete) {
      const targetUrl = `/onboarding?step=${onboardingStatus.nextStep}`;
      if (
        url.pathname !== "/onboarding" ||
        url.searchParams.get("step") !== onboardingStatus.nextStep.toString()
      ) {
        return nextjsMiddlewareRedirect(request, targetUrl);
      }
      return;
    }

    // Onboarding complete - get user role for routing
    const userRole = await fetchQuery(
      api.auth.getUserRole,
      {},
      {
        url: process.env.NEXT_PUBLIC_CONVEX_URL!,
        token: token,
      },
    );

    const role = userRole?.type;

    // ADMIN - Full access to /admin, redirect from /dashboard to /admin
    if (role === "admin") {
      if (isCustomerRoute(request)) {
        return nextjsMiddlewareRedirect(request, "/admin");
      }
      if (isAdminRoute(request)) {
        return; // Allow
      }
    }

    // CLIENT - Access to /dashboard only, no /admin access
    if (role === "client") {
      if (isAdminRoute(request)) {
        return nextjsMiddlewareRedirect(request, "/dashboard");
      }
      if (isCustomerRoute(request)) {
        return; // Allow
      }
    }
  } catch (error) {
    console.error("Error checking user role:", error);
    return nextjsMiddlewareRedirect(request, "/sign-in");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
