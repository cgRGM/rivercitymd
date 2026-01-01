import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isCustomerRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const { userId, getToken } = await auth();
  const url = new URL(request.url);

  // Allow public routes
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", url.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // User is authenticated - check their onboarding status and role
  try {
    const token = await getToken();

    if (!token) {
      // If we can't get a token, redirect to sign-in
      const signInUrl = new URL("/sign-in", request.url);
      return NextResponse.redirect(signInUrl);
    }

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
      // Allow access to onboarding route
      if (isOnboardingRoute(request)) {
        return NextResponse.next();
      }
      // Redirect to onboarding
      const targetUrl = `/onboarding?step=${onboardingStatus.nextStep}`;
      return NextResponse.redirect(new URL(targetUrl, request.url));
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
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (isAdminRoute(request)) {
        return NextResponse.next(); // Allow
      }
    }

    // CLIENT - Access to /dashboard only, no /admin access
    if (role === "client") {
      if (isAdminRoute(request)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      if (isCustomerRoute(request)) {
        return NextResponse.next(); // Allow
      }
    }

    // Allow onboarding route for authenticated users (in case they need to update info)
    if (isOnboardingRoute(request)) {
      return NextResponse.next();
    }
  } catch (error) {
    console.error("Error checking user role:", error);
    // On error, redirect to sign-in
    const signInUrl = new URL("/sign-in", request.url);
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
