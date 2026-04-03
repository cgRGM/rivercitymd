"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { sanitizeRedirectPath } from "@/lib/auth-routing";

export default function SignInPage() {
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
