import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const alt = "Book Your Mobile Detailing Online | River City Mobile Detailing";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  // Load logo
  const logoData = await fetch(
    new URL("../../public/BoldRiverCityMobileDetailingLogo.png", import.meta.url)
  ).then((res) => res.arrayBuffer());
  const logoBase64 = Buffer.from(logoData).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  // Load car image
  const carData = await fetch(
    new URL("../../public/luxury-car-being-detailed-professionally.jpg", import.meta.url)
  ).then((res) => res.arrayBuffer());
  const carBase64 = Buffer.from(carData).toString("base64");
  const carDataUrl = `data:image/jpeg;base64,${carBase64}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#faf9f6",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px",
          color: "#1c1917",
          position: "relative",
        }}
      >
        {/* Left Column: Branding and CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "520px",
            height: "100%",
          }}
        >
          {/* Logo & Brand Name */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              src={logoDataUrl}
              alt="River City Logo"
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
              }}
            />
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#1c1917",
              }}
            >
              River City Mobile Detailing
            </span>
          </div>

          {/* Heading and Subheading */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              marginTop: "20px",
              marginBottom: "20px",
            }}
          >
            {/* Tag / Badge */}
            <div
              style={{
                display: "flex",
                width: "fit-content",
                backgroundColor: "rgba(11, 132, 158, 0.08)",
                border: "1px solid rgba(11, 132, 158, 0.15)",
                color: "#0b849e",
                padding: "6px 12px",
                borderRadius: "9999px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Serving Central Arkansas
            </div>

            <h1
              style={{
                fontSize: "48px",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                margin: 0,
                color: "#1c1917",
              }}
            >
              Premium mobile detailing at your{" "}
              <span style={{ color: "#0b849e" }}>doorstep</span>
            </h1>

            <p
              style={{
                fontSize: "18px",
                color: "#57534e",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              Showroom-quality car care delivered directly to you. Fast online scheduling for Sedans, SUVs, and Trucks.
            </p>
          </div>

          {/* CTA Button and Rating Summary */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                backgroundColor: "#1c1917",
                color: "#faf9f6",
                padding: "14px 28px",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "16px",
              }}
            >
              Book Your Detail
            </div>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#78716c",
              }}
            >
              ★ 5.0 Rated (500+ Reviews)
            </span>
          </div>
        </div>

        {/* Right Column: Visual Image with Floating Cards */}
        <div
          style={{
            position: "relative",
            width: "500px",
            height: "350px",
            display: "flex",
          }}
        >
          {/* Main Car Image */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "24px",
              overflow: "hidden",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              display: "flex",
            }}
          >
            <img
              src={carDataUrl}
              alt="Car Detailing"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>

          {/* Floating Rating Badge */}
          <div
            style={{
              position: "absolute",
              top: "-15px",
              right: "-15px",
              backgroundColor: "#ffffff",
              border: "1px solid rgba(0, 0, 0, 0.06)",
              borderRadius: "16px",
              padding: "10px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0b849e",
              }}
            >
              5.0★
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#78716c",
                marginTop: "1px",
              }}
            >
              Average Rating
            </span>
          </div>

          {/* Floating Happy Customers Badge */}
          <div
            style={{
              position: "absolute",
              bottom: "-15px",
              left: "-15px",
              backgroundColor: "#ffffff",
              border: "1px solid rgba(0, 0, 0, 0.06)",
              borderRadius: "16px",
              padding: "10px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0b849e",
              }}
            >
              500+
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#78716c",
                marginTop: "1px",
              }}
            >
              Happy Customers
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
