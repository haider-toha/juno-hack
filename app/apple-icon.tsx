import { ImageResponse } from "next/og";

// iOS home-screen icon. Navy field so it reads as a tile; white "p" + indigo
// period keeps the same lockup grammar as the wordmark / tab favicon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1b3d",
          fontSize: 108,
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: "#ffffff",
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
