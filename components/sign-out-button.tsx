"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";

export default function SignOutButton() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return null;
  }

  return (
    <ClerkSignOutButton redirectUrl="/">
      <button className="bg-slate-200 dark:bg-slate-800 text-foreground rounded-md px-2 py-1">
        Sign out
      </button>
    </ClerkSignOutButton>
  );
}
