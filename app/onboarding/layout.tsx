import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims, getToken } = await auth();

  // Check if user exists in Convex and if onboarding is complete
  // Use Convex as the source of truth (not Clerk metadata) to avoid race conditions
  try {
    const token = await getToken();
    if (token) {
      // First check if user exists
      const userRole = await fetchQuery(
        api.auth.getUserRole,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token: token,
        },
      );

      // If user doesn't exist, allow onboarding to proceed
      if (!userRole) {
        return <>{children}</>;
      }

      // User exists - check onboarding status using Convex (source of truth)
      const onboardingStatus = await fetchQuery(
        api.users.getOnboardingStatus,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token: token,
        },
      );

      // If onboarding is complete in Convex, redirect to dashboard
      if (onboardingStatus.isComplete) {
        redirect("/dashboard");
      }
    }
  } catch (error) {
    // If there's an error checking user role or onboarding status, allow onboarding to proceed
    // This prevents blocking users from completing onboarding due to transient errors
    console.error("Error checking user status in onboarding layout:", error);
  }

  return <>{children}</>;
}

