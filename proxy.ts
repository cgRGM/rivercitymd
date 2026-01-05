import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isCustomerRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const {
    userId,
    isAuthenticated,
    sessionClaims,
    redirectToSignIn,
    getToken,
    orgId,
  } = await auth();
  const url = new URL(req.url);

  // Allow public routes (including sign-in and sign-up)
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign-in
  if (!isAuthenticated) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // If user is authenticated and on sign-in page, check onboarding and redirect appropriately
  // This ensures onboarding checks happen before any redirect
  if (url.pathname.startsWith("/sign-in")) {
    try {
      const token = await getToken({ template: "convex" });

      if (!token) {
        // No token, let them stay on sign-in page
        return NextResponse.next();
      }

      // Check if user exists in Convex
      const userRole = await fetchQuery(
        api.auth.getUserRole,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token: token,
        },
      );

      // If user doesn't exist in Convex, redirect to onboarding
      if (!userRole) {
        const onboardingUrl = new URL("/onboarding", req.url);
        return NextResponse.redirect(onboardingUrl);
      }

      // User exists - check onboarding completion status
      const onboardingStatus = await fetchQuery(
        api.users.getOnboardingStatus,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token: token,
        },
      );

      // If onboarding is not complete, redirect to onboarding
      if (!onboardingStatus.isComplete) {
        const onboardingUrl = new URL("/onboarding", req.url);
        return NextResponse.redirect(onboardingUrl);
      }

      // Onboarding is complete - redirect based on organization membership
      const isInOrganization = !!orgId;
      const role = isInOrganization ? "admin" : userRole.type;

      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin", req.url));
      } else {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    } catch (error) {
      // If there's an error, let them stay on sign-in page
      console.error("Error checking user status in sign-in middleware:", error);
      return NextResponse.next();
    }
  }

  // For users visiting /onboarding, don't try to redirect
  if (isAuthenticated && isOnboardingRoute(req)) {
    return NextResponse.next();
  }

  // First, check if Convex user exists (required before checking onboarding status)
  // This prevents infinite redirect loops when Clerk metadata says onboarding is complete
  // but Convex user record doesn't exist
  try {
    const token = await getToken({ template: "convex" });

    if (!token) {
      const signInUrl = new URL("/sign-in", req.url);
      return NextResponse.redirect(signInUrl);
    }

    const userRole = await fetchQuery(
      api.auth.getUserRole,
      {},
      {
        url: process.env.NEXT_PUBLIC_CONVEX_URL!,
        token: token,
      },
    );

    // If userRole is null, the user doesn't exist in Convex
    // Redirect to onboarding to create the user record, regardless of Clerk metadata
    if (!userRole) {
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    // User exists in Convex - now check onboarding completion status
    // Check both Clerk metadata AND Convex user record to handle race conditions
    // where Clerk metadata might be stale but Convex record is up-to-date
    const onboardingStatus = await fetchQuery(
      api.users.getOnboardingStatus,
      {},
      {
        url: process.env.NEXT_PUBLIC_CONVEX_URL!,
        token: token,
      },
    );

    // If onboarding is not complete in Convex, redirect to onboarding
    // This is the source of truth - if Convex says incomplete, user needs to complete it
    if (!onboardingStatus.isComplete) {
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    // Onboarding is complete in Convex - allow access
    // Note: We don't strictly require Clerk metadata to be updated because:
    // 1. Convex record is the source of truth
    // 2. Clerk metadata update is eventually consistent
    // 3. This prevents race conditions where metadata is stale but onboarding is actually complete

    // User exists and onboarding is complete - proceed with role-based routing
    // Role is determined by organization membership:
    // - Users in an organization (orgId exists) → admin
    // - Users not in an organization → client
    // Check both Convex role and current organization membership
    const isInOrganization = !!orgId;
    const role = isInOrganization ? "admin" : userRole.type;

    // ADMIN - Full access to /admin, redirect from /dashboard to /admin
    if (role === "admin") {
      if (isCustomerRoute(req)) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      if (isAdminRoute(req)) {
        return NextResponse.next(); // Allow
      }
    }

    // CLIENT - Access to /dashboard only, no /admin access
    if (role === "client") {
      if (isAdminRoute(req)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      if (isCustomerRoute(req)) {
        return NextResponse.next(); // Allow
      }
    }

    // If we have a valid role but the route doesn't match, allow access
    // (handles other protected routes that aren't admin/dashboard specific)
    return NextResponse.next();
  } catch (error) {
    console.error("Error checking user role:", error);
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
