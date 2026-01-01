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

  // First check if Convex user exists - if not, allow onboarding to proceed
  // This prevents infinite redirect loops when Clerk metadata says onboarding is complete
  // but Convex user record doesn't exist
  try {
    const token = await getToken();
    if (token) {
      const userRole = await fetchQuery(
        api.auth.getUserRole,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token: token,
        },
      );

      // If user exists in Convex AND onboarding is complete, redirect to dashboard
      // If user doesn't exist, allow onboarding to proceed (they need to create the record)
      if (userRole && sessionClaims?.metadata?.onboardingComplete === true) {
        redirect("/dashboard");
      }
    }
  } catch (error) {
    // If there's an error checking user role, allow onboarding to proceed
    // This prevents blocking users from completing onboarding due to transient errors
    console.error("Error checking user role in onboarding layout:", error);
  }

  return <>{children}</>;
}

