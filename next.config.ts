import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the dev-mode indicator badge — it overlaps the bottom-docked UI in the
  // phone frame and pollutes demo screenshots.
  devIndicators: false,
  // /api/seed reads the demo letter off disk at a path it computes, so the
  // build's tracer cannot see the dependency and would ship the route without
  // the file. It works in dev and ENOENTs in production, which is the worst
  // shape a failure can have.
  outputFileTracingIncludes: {
    "/api/seed": ["./fixtures/discharge-summaries/**"],
  },
};

export default nextConfig;
