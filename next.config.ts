import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root. Without this, Turbopack walks up past the repo
    // and picks up an unrelated package-lock.json from the home directory.
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["neo4j-driver"],
  // The floating dev badge overlaps the page in captured screenshots.
  devIndicators: false,
};

export default nextConfig;
