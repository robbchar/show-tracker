import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "artworks.thetvdb.com",
        port: "",
        pathname: "/banners/**",
      },
    ],
  },
};

export default nextConfig;
