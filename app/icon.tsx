import { ImageResponse } from "next/og";

// Tab favicon: "p" + indigo square period — same grammar as the wordmark.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: "#0d1b3d",
          lineHeight: 1,
        }}
      >
        <span>p</span>
        <div
          style={{
            width: 5,
            height: 5,
            marginLeft: 1,
            marginBottom: 2,
            background: "#2d51fb",
            borderRadius: 1,
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
