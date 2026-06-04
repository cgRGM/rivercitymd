"use client";

import { ReactNode, useCallback } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convex = new ConvexReactClient(convexUrl);

function useUnauthenticatedConvexAuth() {
  const fetchAccessToken = useCallback(async () => null, []);

  return {
    isLoading: false,
    isAuthenticated: false,
    fetchAccessToken,
  };
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  if (!clerkPublishableKey) {
    return (
      <ConvexProviderWithAuth client={convex} useAuth={useUnauthenticatedConvexAuth}>
        {children}
      </ConvexProviderWithAuth>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
