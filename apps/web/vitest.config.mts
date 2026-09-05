import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // `next build`가 `.next/standalone` 아래에 tests/ 사본을 실어 둔다. 빼지 않으면 빌드 뒤 `npm test`가
    // 같은 시험을 두 번 돌리고, 사본 쪽은 react 실행 파일을 못 찾아 빨갛게 된다. CI는 시험이 빌드보다 먼저라 못 보던 자리다.
    exclude: [...configDefaults.exclude, "**/.next/**"],
  },
});
