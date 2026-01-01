"use client";

import { SignIn } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SignInPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const userRole = useQuery(api.auth.getUserRole);

  useEffect(() => {
    // Only require isSignedIn and userRole for redirect
    // userRole will be null if user record doesn't exist in Convex,
    // in which case middleware will handle redirect to onboarding
    if (isSignedIn && userRole) {
      // User is authenticated and has a role, redirect based on role
      if (userRole.type === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isSignedIn, userRole, router]);

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

