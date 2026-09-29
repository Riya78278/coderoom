import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // The project lives in a nested folder; pin the workspace root so
  // Turbopack doesn't pick up package-lock.json from ancestor directories.
  turbopack: {
    root: path.join(process.cwd()),
  },
};

export default nextConfig;
