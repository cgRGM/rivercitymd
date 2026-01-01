import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isCustomerRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
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

  // For authenticated users, we'll check role in the page components
  // Middleware just ensures authentication, role-based routing happens client-side
  // This is because we need to query Convex to get the user's role
  
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
