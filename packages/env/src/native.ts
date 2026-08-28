const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.trim();
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

if (!convexUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_CONVEX_URL. Copy apps/native/.env.example to apps/native/.env and set the Convex deployment URL.",
  );
}

if (!clerkPublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copy apps/native/.env.example to apps/native/.env and set the Clerk publishable key.",
  );
}

export const env = {
  EXPO_PUBLIC_CONVEX_URL: convexUrl,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
} as const;
