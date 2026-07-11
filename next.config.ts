import type { NextConfig } from "next";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((s) => s.trim())
  : [];

module.exports = {
  allowedDevOrigins,
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

