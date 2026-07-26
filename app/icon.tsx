import { ImageResponse } from "next/og";

// Tab favicon: the wordmark collapses to "p." — full "portico." is illegible
// at 32px. Indigo period is the same accent as `PorticoWordmark`.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: "#0d1b3d",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        p<span style={{ color: "#2d51fb" }}>.</span>
      </div>
    ),
    { ...size },
  );
}
