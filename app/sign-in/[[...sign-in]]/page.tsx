"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  // Let Clerk's fallbackRedirectUrl and the middleware handle redirects
  // The middleware will check onboarding status and route appropriately
  // This prevents bypassing onboarding checks with client-side redirects

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

