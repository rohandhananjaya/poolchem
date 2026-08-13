import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((s) => s.trim())
  : [];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  images: {
    remotePatterns: process.env.R2_PUBLIC_URL
      ? [{ protocol: "https", hostname: new URL(process.env.R2_PUBLIC_URL).hostname }]
      : [],
  },
  experimental: {
    serverActions: {
      // Company logo uploads (2MB cap) and visit photos (camera JPEGs reach
      // 4–8MB) go through Server Actions — raise the default 1MB body limit to
      // cover the file plus multipart overhead.
      bodySizeLimit: "8mb",
    },
  },
};

export default withSerwist(nextConfig);

