import { ImageResponse } from "next/og";

// iOS home-screen / notification tile. Navy field; white "p" + indigo square
// period — same lockup grammar as `brand/portico-wordmark.png`.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d1b3d",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          fontSize: 108,
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: "#ffffff",
          lineHeight: 1,
        }}
      >
        <span>p</span>
        <div
          style={{
            width: 22,
            height: 22,
            marginLeft: 4,
            marginBottom: 14,
            background: "#2d51fb",
            borderRadius: 3,
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
