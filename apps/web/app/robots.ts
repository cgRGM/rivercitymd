import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://rivercitymd.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/onboarding/",
          "/api/",
          "/sign-in/",
          "/sign-up/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
