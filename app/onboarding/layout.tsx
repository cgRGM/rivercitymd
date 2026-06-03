import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getRoleHomePath } from "@/lib/auth-routing";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims, getToken } = await auth();
  let redirectPath: string | null = null;

  if (sessionClaims?.metadata?.onboardingComplete === true) {
    try {
      const token = await getToken({ template: "convex" });
      if (!token) {
        return <>{children}</>;
      }

      const userRole = await fetchQuery(
        api.auth.getUserRole,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token,
        },
      );
      if (!userRole) {
        return <>{children}</>;
      }

      const hasCompletedOnboarding = await fetchQuery(
        api.users.hasCompletedOnboarding,
        {},
        {
          url: process.env.NEXT_PUBLIC_CONVEX_URL!,
          token,
        },
      );
      if (hasCompletedOnboarding) {
        redirectPath = getRoleHomePath(userRole.type);
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    }
  }

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <>{children}</>;
}
