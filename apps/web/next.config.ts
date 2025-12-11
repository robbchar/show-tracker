import type { NextConfig } from "next";

const nextConfig: NextConfig = { images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'artworks.thetvdb.com',
        port: '',
        pathname: '/banners/**',
      },
    ],
  },
};

export default nextConfig;
