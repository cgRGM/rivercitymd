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
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b0f19 0%, #030712 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "80px",
          color: "#ffffff",
          position: "relative",
        }}
      >
        {/* Glowing aura background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundImage: "radial-gradient(circle at 80% 20%, rgba(14, 165, 233, 0.12) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Top Header Row (Logo & Brand) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            zIndex: 10,
          }}
        >
          {/* Stylized River Logo in SVG */}
          <svg
            width="44"
            height="44"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 34C14 26 18 38 26 30C34 22 34 26 42 18"
              stroke="#0ea5e9"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6 22C14 14 18 26 26 18C34 10 34 14 42 6"
              stroke="#38bdf8"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "#ffffff",
                textTransform: "uppercase",
              }}
            >
              River City
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.2em",
                color: "#38bdf8",
                textTransform: "uppercase",
                marginTop: "-2px",
              }}
            >
              Mobile Detailing
            </span>
          </div>
        </div>

        {/* Main Content Layout */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "48px",
            zIndex: 10,
          }}
        >
          {/* Left Column: text content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1.2,
              gap: "24px",
            }}
          >
            <h1
              style={{
                fontSize: "56px",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
                color: "#ffffff",
              }}
            >
              Book Your Detailing Service{" "}
              <span style={{ color: "#0ea5e9" }}>Online</span>
            </h1>

            <p
              style={{
                fontSize: "22px",
                color: "#94a3b8",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              Showroom-quality mobile car care directly at your location. Serving Little Rock, Conway, and Central Arkansas.
            </p>
          </div>

          {/* Right Column: Stylized Booking Ticket/Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 0.8,
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Booking Preview
              </span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", padding: "4px 10px", borderRadius: "9999px" }}>
                Available
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                Premium Full Detail
              </span>
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>
                Sedan / SUV / Truck packages
              </span>
            </div>

            <div style={{ height: "1px", backgroundColor: "rgba(255, 255, 255, 0.08)", width: "100%" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#0ea5e9", fontSize: "14px" }}>📅</span>
                <span style={{ fontSize: "14px", color: "#e2e8f0" }}>Select Date & Time Slot</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#0ea5e9", fontSize: "14px" }}>📍</span>
                <span style={{ fontSize: "14px", color: "#e2e8f0" }}>Your Doorstep (Central AR)</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0ea5e9",
                color: "#ffffff",
                padding: "12px",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "15px",
                marginTop: "12px",
              }}
            >
              Confirm Appointment
            </div>
          </div>
        </div>

        {/* Footer / Highlights Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            zIndex: 10,
            marginTop: "auto",
          }}
        >
          {/* Badge 1 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "9999px",
              padding: "10px 20px",
              gap: "8px",
            }}
          >
            <span style={{ color: "#fbbf24", fontSize: "18px" }}>★</span>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#f8fafc" }}>
              5.0 Star Rated
            </span>
          </div>

          {/* Badge 2 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "9999px",
              padding: "10px 20px",
              gap: "8px",
            }}
          >
            <span style={{ color: "#0ea5e9", fontSize: "16px" }}>✦</span>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#f8fafc" }}>
              Serving Central Arkansas
            </span>
          </div>

          {/* Badge 3 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "9999px",
              padding: "10px 20px",
              gap: "8px",
            }}
          >
            <span style={{ color: "#10b981", fontSize: "18px" }}>●</span>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#f8fafc" }}>
              Open 7 Days a Week
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
