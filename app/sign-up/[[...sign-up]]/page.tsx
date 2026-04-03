"use client";

import { SignUp } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { sanitizeRedirectPath } from "@/lib/auth-routing";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const redirectPath = sanitizeRedirectPath(
    searchParams.get("redirect_url"),
    "/onboarding",
  );

  useEffect(() => {
    if (isSignedIn) {
      router.push(redirectPath);
    }
  }, [isSignedIn, redirectPath, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={redirectPath}
      />
    </div>
  );
}
