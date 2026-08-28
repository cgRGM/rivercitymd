const placeholderConvexUrl = "https://placeholder.convex.cloud";

/**
 * Web-only environment values. Keep the fallback so the public site can render
 * during preview builds before a Convex deployment is connected.
 */
export const env = {
  NEXT_PUBLIC_CONVEX_URL:
    process.env.NEXT_PUBLIC_CONVEX_URL?.trim() || placeholderConvexUrl,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || undefined,
} as const;
