import { hostname, networkInterfaces } from "node:os";
import { join } from "node:path";
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
  // 매뉴얼 화면은 앱 폴더 밖(저장소 뿌리)의 원본을 읽는다. 추적 기준을 저장소 뿌리로 올려야
  // 그 파일들이 배포본에 실린다. 기준을 안 올리면 Turbopack이 `..`로 나가는 glob을 거부해
  // 빌드가 통째로 멈춘다.
  outputFileTracingRoot: join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/admin/manual/**": ["../../manual/**/*.md", "../../RULES.md"],
  },
  // 설정 파일을 읽는 라우트 때문에 `.env.local`이 추적 목록에 들어간다. 그대로 두면
  // 배포본을 싸는 순간 연결 문자열과 API 키가 같이 실린다. 목록에서 빼 둔다.
  outputFileTracingExcludes: {
    "**": ["**/.env*"],
  },
};

export default nextConfig;
