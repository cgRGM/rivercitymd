import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { StructuredData } from "@/components/seo/structured-data";
import { Analytics } from "@vercel/analytics/next";

// Validate Clerk publishable key
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Please set it in your environment variables.",
  );
}

import { Suspense } from "react";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://rivercitymd.vercel.app";

export const metadata: Metadata = {
  title: "River City Mobile Detailing | Premium Car Detailing Platform",
  description:
    "Professional mobile car detailing services in Central Arkansas. Book online and manage your vehicle care with our premium platform.",
  keywords: [
    "car detailing",
    "mobile car detailing",
    "auto detailing",
    "car wash",
    "Central Arkansas",
    "Little Rock",
    "vehicle detailing",
    "ceramic coating",
    "paint correction",
  ],
  authors: [{ name: "River City Mobile Detailing" }],
  creator: "River City Mobile Detailing",
  publisher: "River City Mobile Detailing",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "River City Mobile Detailing",
    title: "River City Mobile Detailing | Premium Car Detailing Platform",
    description:
      "Professional mobile car detailing services in Central Arkansas. Book online and manage your vehicle care with our premium platform.",
    images: [
      {
        url: `${siteUrl}/BoldRiverCityMobileDetailingLogo.png`,
        width: 1200,
        height: 1200,
        alt: "River City Mobile Detailing Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "River City Mobile Detailing | Premium Car Detailing Platform",
    description:
      "Professional mobile car detailing services in Central Arkansas. Book online and manage your vehicle care with our premium platform.",
    images: [`${siteUrl}/BoldRiverCityMobileDetailingLogo.png`],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "android-chrome-192x192",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "android-chrome-512x512",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signUpUrl="/sign-up"
      signInUrl="/sign-in"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/onboarding"
    >
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <StructuredData siteUrl={siteUrl} />
          <ConvexClientProvider>
            <Suspense fallback={null}>{children}</Suspense>
          </ConvexClientProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
