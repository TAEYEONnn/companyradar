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
  // These packages must NOT be webpack-bundled:
  // - @napi-rs/canvas: ships platform-specific .node binaries — bundling breaks them
  // - pdfjs-dist: when bundled, import.meta.url becomes a webpack module ID so the
  //   default workerSrc "./pdf.worker.mjs" resolves to the wrong chunks directory
  //   instead of node_modules/pdfjs-dist/legacy/build/
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;