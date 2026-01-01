import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims } = await auth();

  // If onboarding is already complete, redirect to dashboard
  if (sessionClaims?.metadata?.onboardingComplete === true) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

