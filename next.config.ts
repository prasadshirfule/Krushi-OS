import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
    '127.0.0.1:3000',
    'localhost',
    'localhost:3000',
    '192.168.1.16',
    '192.168.1.16:3000',
  ],
};

export default nextConfig;
