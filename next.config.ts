import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is a static UI. All media work happens in the API service.
  output: "export",
};

export default nextConfig;
