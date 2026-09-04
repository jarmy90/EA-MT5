import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Freebuff serves the development preview through a cross-origin proxy.
  allowedDevOrigins: ["*.daytonaproxy01.net"],
  devIndicators: false,
};

export default nextConfig;
