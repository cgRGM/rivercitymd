interface StructuredDataProps {
  businessName?: string;
  address?: string;
  cityStateZip?: string;
  phone?: string;
  logoUrl?: string;
  siteUrl?: string;
}

export function StructuredData({
  businessName = "River City Mobile Detailing",
  address,
  cityStateZip = "Little Rock, AR",
  phone = "(501) 454-7140",
  logoUrl,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rivercitymd.vercel.app",
}: StructuredDataProps) {
  // Build address string
  let fullAddress = "";
  if (address && cityStateZip) {
    fullAddress = `${address}, ${cityStateZip}`;
  } else if (cityStateZip) {
    fullAddress = cityStateZip;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: businessName,
    image: logoUrl || `${siteUrl}/BoldRiverCityMobileDetailingLogo.png`,
    "@id": siteUrl,
    url: siteUrl,
    telephone: phone,
    priceRange: "$$",
    address: fullAddress
      ? {
          "@type": "PostalAddress",
          streetAddress: address || "",
          addressLocality: cityStateZip.split(",")[0]?.trim() || "Little Rock",
          addressRegion: cityStateZip.split(",")[1]?.trim() || "AR",
          addressCountry: "US",
        }
      : undefined,
    geo: {
      "@type": "GeoCoordinates",
      latitude: "34.7465",
      longitude: "-92.2896",
    },
    areaServed: {
      "@type": "City",
      name: "Central Arkansas",
    },
    serviceType: "Mobile Car Detailing Service",
    description:
      "Professional mobile car detailing services in Central Arkansas. Book online and manage your vehicle care with our premium platform.",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "07:00",
        closes: "20:00",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
