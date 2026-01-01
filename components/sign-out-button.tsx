"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  if (!isSignedIn) {
    return null;
  }

  return (
    <ClerkSignOutButton
      redirectUrl="/"
      signOutCallback={() => {
        router.push("/");
      }}
    >
      <button className="bg-slate-200 dark:bg-slate-800 text-foreground rounded-md px-2 py-1">
        Sign out
      </button>
    </ClerkSignOutButton>
  );
}
