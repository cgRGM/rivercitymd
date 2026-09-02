"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { sanitizeRedirectPath } from "@/lib/auth-routing";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function SignInWithClerk() {
  const searchParams = useSearchParams();
  const redirectPath = sanitizeRedirectPath(
    searchParams.get("redirect_url"),
    "/dashboard",
  );

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
        fallbackRedirectUrl={redirectPath}
      />
    </div>
  );
}

export default function SignInPage() {
  if (!clerkPublishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
        <div className="max-w-md rounded-xl border bg-background p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Sign in unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Account sign-in is not configured in this preview. Guest booking is
            still available.
          </p>
        </div>
      </div>
    );
  }

  return <SignInWithClerk />;
}
