import type { NextConfig } from "next";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",")
  : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins,
  // Prevent Next.js from bundling these native packages — let Vercel resolve
  // them from node_modules at runtime. Bundling @napi-rs/canvas breaks because
  // it ships platform-specific .node binaries; bundling pdfjs-dist breaks its
  // dynamic worker path resolution.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;