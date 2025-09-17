import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure static files are served properly
  experimental: {
    optimizePackageImports: ['lucide-react']
  },
  images: {
    // Allow unoptimized images for chess pieces
    unoptimized: true,
    // Add domains if needed for external images
    domains: [],
  },
  // Ensure static assets are properly handled
  trailingSlash: false,
  assetPrefix: '',
};

export default nextConfig;
