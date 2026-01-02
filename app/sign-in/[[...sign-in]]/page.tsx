"use client";

import { SignIn } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignInPage() {
  const router = useRouter();
  const { isSignedIn, orgId, isLoaded } = useAuth();

  useEffect(() => {
    // Wait for auth to be loaded before checking
    if (!isLoaded) return;

    // If user is signed in, redirect based on organization membership
    // - Users in organization (orgId exists) → admin → /admin
    // - Users not in organization → client → /dashboard
    // If user doesn't exist in Convex yet, middleware will redirect to onboarding
    if (isSignedIn) {
      if (orgId) {
        // User is in an organization → admin
        router.push("/admin");
      } else {
        // User is not in an organization → client
        router.push("/dashboard");
      }
    }
  }, [isSignedIn, orgId, isLoaded, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}

