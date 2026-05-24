import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure static files are served properly
  experimental: {
    optimizePackageImports: ['lucide-react']
  },
  // The Stockfish engine wrapper spawns a Node child process pointed at
  // node_modules/stockfish/bin/stockfish-18.js (a WASM JS shim). That
  // path is built at runtime, so Next.js's tracer can't see it and won't
  // include the file in the serverless function bundle — the bot-move
  // route would 500 in production with ENOENT. Explicitly trace the
  // whole bin/ folder for the bot-move route.
  outputFileTracingIncludes: {
    "/api/games/[id]/bot-move": ["./node_modules/stockfish/bin/**"],
  },
  // Keep `stockfish` as an external require so Next.js doesn't try to
  // bundle its WASM shim through webpack (would mangle the wasm path
  // resolution inside the shim).
  serverExternalPackages: ["stockfish"],
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
