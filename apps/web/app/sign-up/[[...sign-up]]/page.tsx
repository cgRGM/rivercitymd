"use client";

import { SignUp } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { sanitizeRedirectPath } from "@/lib/auth-routing";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function SignUpWithClerk() {
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

export default function SignUpPage() {
  if (!clerkPublishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
        <div className="max-w-md rounded-xl border bg-background p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Account setup unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Online account creation is not configured in this preview. You can
            still complete booking as a guest.
          </p>
        </div>
      </div>
    );
  }

  return <SignUpWithClerk />;
}
