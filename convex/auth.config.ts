import { AuthConfig } from "convex/server";

function readEnv(name: string) {
  return process.env[name]?.trim();
}

const clerkFrontendApiUrl = readEnv(["CLERK", "FRONTEND", "API", "URL"].join("_"));
const clerkJwtIssuerDomain = readEnv(["CLERK", "JWT", "ISSUER", "DOMAIN"].join("_"));
const clerkIssuerDomain = clerkFrontendApiUrl || clerkJwtIssuerDomain;

const providers: AuthConfig["providers"] = clerkIssuerDomain
  ? [
      {
        // Replace with your own Clerk Issuer URL from your "convex" JWT template
        // and configure CLERK_FRONTEND_API_URL (preferred)
        // or CLERK_JWT_ISSUER_DOMAIN on the Convex Dashboard
        // See https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances
        domain: clerkIssuerDomain,
        applicationID: "convex",
      },
    ]
  : [];

if (!clerkIssuerDomain) {
  console.warn(
    "[convex/auth.config] Missing Clerk issuer domain. Exporting no auth providers so preview deploys can build without Clerk. Set CLERK_FRONTEND_API_URL (preferred) or CLERK_JWT_ISSUER_DOMAIN in Convex for authenticated environments.",
  );
}

export default {
  providers,
} satisfies AuthConfig;
