import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["phaser"],
  serverExternalPackages: ["@cursor/sdk"],
};

export default nextConfig;
