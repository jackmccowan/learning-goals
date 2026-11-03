import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal self-contained server in .next/standalone for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Puts the small stylesheet directly in the HTML, so the browser can paint
    // without first waiting for a render-blocking CSS request (improves LCP).
    inlineCss: true,
  },
};

export default nextConfig;
