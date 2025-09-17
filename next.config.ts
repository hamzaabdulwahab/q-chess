import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure static files are served properly
  experimental: {
    optimizePackageImports: ['lucide-react']
  },
  images: {
    // Allow unoptimized images for chess pieces
    unoptimized: false,
    // Add domains if needed for external images
    domains: [],
  },
  // Ensure public assets are accessible
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/pieces/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/ticker.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
