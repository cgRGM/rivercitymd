import { AuthConfig } from "convex/server";

const clerkFrontendApiUrl = process.env.CLERK_FRONTEND_API_URL?.trim();
const clerkJwtIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN?.trim();
const clerkIssuerDomain = clerkFrontendApiUrl || clerkJwtIssuerDomain;

// Validate required environment variable
if (!clerkIssuerDomain) {
  throw new Error(
    "Missing Clerk issuer domain. Set CLERK_FRONTEND_API_URL (preferred) or CLERK_JWT_ISSUER_DOMAIN in your Convex environment.",
  );
}

export default {
  providers: [
    {
      // Replace with your own Clerk Issuer URL from your "convex" JWT template
      // and configure CLERK_FRONTEND_API_URL (preferred)
      // or CLERK_JWT_ISSUER_DOMAIN on the Convex Dashboard
      // See https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances
      domain: clerkIssuerDomain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
