import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "exceljs", "web-push"],
  webpack: (config, { dev }) => {
    if (dev) {
      // Файловый pack-cache давал ENOENT; `false` иногда режет связку CSS+HMR — memory стабильнее для стилей.
      config.cache = { type: "memory" };
      // Reduce file-descriptor pressure in local dev (fixes EMFILE/slow hot updates on macOS).
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ["**/.git/**", "**/.next/**", "**/node_modules/**"]
      };
    }
    return config;
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "date-fns-tz"],
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "t.me", pathname: "/**" },
      { protocol: "https", hostname: "telegram.org", pathname: "/**" }
    ]
  }
};

export default nextConfig;
