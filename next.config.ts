import type { NextConfig } from "next";

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
      // Company logo uploads go through a Server Action (2MB cap) — raise the
      // default 1MB body limit to cover the file plus multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;

