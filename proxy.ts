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
    // Fast path: Check session claims first (no API call)
    if (sessionClaims?.metadata?.onboardingComplete) {
      // Onboarding is complete according to Clerk - redirect based on organization membership
      const isInOrganization = !!orgId;
      if (isInOrganization) {
        return NextResponse.redirect(new URL("/admin", req.url));
      } else {
        // Need to get role from Convex for client users
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
              if (role === "admin") {
                return NextResponse.redirect(new URL("/admin", req.url));
              } else {
                return NextResponse.redirect(new URL("/dashboard", req.url));
              }
            }
          }
        } catch (error) {
          console.error(
            "Error getting user role in sign-in middleware:",
            error,
          );
        }
        // Fallback to dashboard if we can't determine role
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Fallback: Onboarding not complete or missing - check Convex
    try {
      const token = await getToken({ template: "convex" });

      if (!token) {
        // No token, let them stay on sign-in page
        return NextResponse.next();
      }

      // Check if user exists in Convex and has completed onboarding
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

    // Check if user has completed onboarding in Convex (has address and vehicles)
    const hasCompleted = await fetchQuery(
      api.users.hasCompletedOnboarding,
      {},
      {
        url: process.env.NEXT_PUBLIC_CONVEX_URL!,
        token: token,
      },
    );

    // If onboarding is complete in Convex, handle role-based routing
    if (hasCompleted) {
      const role = userRole.type;
      
      // Check admin route access
      if (isAdminRoute(req)) {
        if (role === "admin") {
          return NextResponse.next(); // Allow admin access
        } else {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
      }
      
      // Check customer route access
      if (isCustomerRoute(req)) {
        if (role === "admin") {
          return NextResponse.redirect(new URL("/admin", req.url));
        } else {
          return NextResponse.next(); // Allow client access
        }
      }
      
      // For other routes, allow access
      return NextResponse.next();
    }

      // User exists but onboarding incomplete - redirect to onboarding
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
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
