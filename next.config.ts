import type { NextConfig } from "next";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",")
  : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins,
  // PDF.js is ESM-only. Bundle it so the route handler keeps dynamic import()
  // semantics instead of turning the worker module into a Node require().
  transpilePackages: ["pdfjs-dist"],
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
