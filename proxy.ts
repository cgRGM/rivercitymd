import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isCustomerRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, isAuthenticated, sessionClaims, redirectToSignIn, getToken } =
    await auth();
  const url = new URL(req.url);

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign-in
  if (!isAuthenticated) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // For users visiting /onboarding, don't try to redirect
  if (isAuthenticated && isOnboardingRoute(req)) {
    return NextResponse.next();
  }

  // Catch users who do not have `onboardingComplete: true` in their publicMetadata
  // Redirect them to the /onboarding route to complete onboarding
  if (isAuthenticated && !sessionClaims?.metadata?.onboardingComplete) {
    const onboardingUrl = new URL("/onboarding", req.url);
    return NextResponse.redirect(onboardingUrl);
  }

  // Onboarding complete - get user role for routing
  try {
    const token = await getToken();

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
    // Even though onboardingComplete is true, they need to complete onboarding again
    // to create their Convex user record
    if (!userRole) {
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    const role = userRole.type;

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
