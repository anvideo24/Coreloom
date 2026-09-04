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
    // 매뉴얼 화면은 저장소 원본을 읽는다. 뿌리의 RULES.md도 화면에 나오므로 같이 실어야 한다.
    "/admin/manual/**": ["../../manual/**/*.md", "../../RULES.md"],
  },
};

export default nextConfig;
