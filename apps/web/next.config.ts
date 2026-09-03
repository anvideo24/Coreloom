import { hostname, networkInterfaces } from "node:os";
import type { NextConfig } from "next";

import { allowedDevelopmentOrigins } from "./src/lib/pwa/dev-origins";

const addresses = Object.values(networkInterfaces())
  .flat()
  .flatMap((item) => (item?.address ? [item.address] : []));

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevelopmentOrigins({
    addresses,
    machineName: hostname(),
    extraOrigins: process.env.CORELOOM_DEV_ORIGINS,
  }),
  outputFileTracingIncludes: {
    "/admin/manual/**": ["../../manual/**/*.md"],
  },
};

export default nextConfig;
