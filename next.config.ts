import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, must-revalidate" },
        { key: "CDN-Cache-Control", value: "no-store" },
      ],
    },
  ],
};

export default nextConfig;
