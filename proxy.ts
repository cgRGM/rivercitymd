import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isCustomerRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { isAuthenticated, sessionClaims, redirectToSignIn, getToken } =
    await auth();
  const url = new URL(req.url);

  const isAuthRoute =
    url.pathname.startsWith("/sign-in") || url.pathname.startsWith("/sign-up");

  // Handle sign-in/sign-up routes first so authenticated users are redirected
  // instead of getting stuck on an auth page.
  if (isAuthRoute) {
    if (!isAuthenticated) {
      return NextResponse.next();
    }

    // Fast path: Clerk metadata says onboarding is complete.
    if (sessionClaims?.metadata?.onboardingComplete) {
      try {
        const token = await getToken({ template: "convex" });
        if (token) {
          const userRole = await fetchQuery(
            api.auth.getUserRole,
            {},
            {
              url: process.env.NEXT_PUBLIC_CONVEX_URL!,
              token: token,
            },
          );
          if (userRole?.type === "admin") {
            return NextResponse.redirect(new URL("/admin", req.url));
          }
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
      } catch (error) {
        console.error("Error getting user role on auth route:", error);
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Fallback: check Convex if metadata isn't complete/missing.
    try {
      const token = await getToken({ template: "convex" });

      // If Convex token is missing (template not ready/misconfigured), don't loop on /sign-in.
      if (!token) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      const userRole = await fetchQuery(
        api.auth.getUserRole,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token: token,
        },
      );

      if (!userRole) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      const hasCompleted = await fetchQuery(
        api.users.hasCompletedOnboarding,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token: token,
        },
      );

      if (!hasCompleted) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      return NextResponse.redirect(
        new URL(userRole.type === "admin" ? "/admin" : "/dashboard", req.url),
      );
    } catch (error) {
      console.error("Error checking auth route status:", error);
      // Safe fallback for authenticated users
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Allow public routes (including sign-in and sign-up)
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

  // Fast path: Check session claims first (no API call)
  // If onboarding is complete according to Clerk, allow access and handle role-based routing
  if (sessionClaims?.metadata?.onboardingComplete) {
    // Onboarding is complete - proceed with role-based routing
    // Role is determined by Convex role field (manually set in dashboard)
    // Check Convex role for admin access
    try {
      const token = await getToken({ template: "convex" });
      if (token) {
        const userRole = await fetchQuery(
          api.auth.getUserRole,
          {},
          {
            url: process.env.NEXT_PUBLIC_CONVEX_URL!,
            token: token,
          },
        );

        if (userRole) {
          const role = userRole.type;

          // ADMIN - Full access to /admin, redirect from /dashboard to /admin
          if (role === "admin") {
            if (isCustomerRoute(req)) {
              return NextResponse.redirect(new URL("/admin", req.url));
            }
            if (isAdminRoute(req)) {
              return NextResponse.next(); // Allow
            }
          } else {
            // CLIENT - Access to /dashboard only, no /admin access
            if (isAdminRoute(req)) {
              return NextResponse.redirect(new URL("/dashboard", req.url));
            }
            if (isCustomerRoute(req)) {
              return NextResponse.next(); // Allow
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking admin role:", error);
      // On error, deny admin access but allow dashboard
      if (isAdminRoute(req)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // If we have a valid onboarding status but the route doesn't match, allow access
    // (handles other protected routes that aren't admin/dashboard specific)
    return NextResponse.next();
  }

  // Fallback: Onboarding not complete or missing - check Convex
  // This handles new users who haven't completed onboarding yet
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
    // Redirect to onboarding to create the user record
    if (!userRole) {
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    // Check if user has completed onboarding in Convex (has address and vehicles)
    // This prevents existing admins from being re-onboarded
    const hasCompleted = await fetchQuery(
      api.users.hasCompletedOnboarding,
      {},
      {
        url: process.env.NEXT_PUBLIC_CONVEX_URL!,
        token: token,
      },
    );

    // If onboarding is complete in Convex, allow access (middleware will handle routing)
    if (hasCompleted) {
      return NextResponse.next();
    }

    // User exists but onboarding incomplete - redirect to onboarding
    const onboardingUrl = new URL("/onboarding", req.url);
    return NextResponse.redirect(onboardingUrl);
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
