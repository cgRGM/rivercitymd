import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims } = await auth();

  // Fast path: Check session claims first (no API call)
  // If onboarding is complete according to Clerk, redirect to dashboard
  if (sessionClaims?.metadata?.onboardingComplete === true) {
    redirect("/dashboard");
  }

  // Onboarding not complete or missing - allow onboarding to proceed
  return <>{children}</>;
}

