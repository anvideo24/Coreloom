import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  cloudAgentEnvironmentFile,
  cloudAgentLoginSecrets,
  cloudAgentRequiredSecrets,
  missingCloudAgentLoginSecrets,
  missingCloudAgentSecrets,
} from "../src/lib/setup/cloud-agent-env";

/**
 * Cursor Cloud Agent 전용.
 * 환경 비밀로 `.env.local`을 만들고(값은 출력하지 않음), 선택적으로 migrate 한다.
 * Windows PC의 `npm run up`을 대체하지 않는다.
 */
function main() {
  const source = Object.fromEntries(
    [
      ...cloudAgentRequiredSecrets,
      ...cloudAgentLoginSecrets,
      "CORELOOM_DATABASE_BRANCH" as const,
      // 이 이름을 빠뜨리면 확인 값이 `.env.local`에 안 실려 migrate 가 늘 거부하고,
      // `cloud:dev` 가 서버를 띄우기 전에 죽는다.
      "CORELOOM_DATABASE_HOST" as const,
    ].map((name) => [name, process.env[name]]),
  );

  const missing = missingCloudAgentSecrets(source);
  if (missing.length > 0) {
    process.stderr.write(
      `Cloud Agent 시각 검증용 비밀이 없습니다: ${missing.join(", ")}\n` +
        "Cursor 환경 Secrets에 위 이름을 넣고 새 에이전트를 띄우세요.\n",
    );
    process.exit(1);
  }

  const loginMissing = missingCloudAgentLoginSecrets(source);
  if (loginMissing.length > 0) {
    process.stderr.write(
      `로그인 시각 검증용 비밀이 없습니다: ${loginMissing.join(", ")}\n` +
        "서버는 뜰 수 있지만 /sign-in 자동 로그인은 못 합니다.\n",
    );
  }

  const envPath = resolve(process.cwd(), ".env.local");
  writeFileSync(envPath, cloudAgentEnvironmentFile(source), "utf8");
  process.stdout.write("Cloud Agent .env.local 준비됨 (값은 출력하지 않음).\n");

  const skipMigrate = process.env.CLOUD_AGENT_SKIP_MIGRATE === "1";
  if (skipMigrate) {
    process.stdout.write("CLOUD_AGENT_SKIP_MIGRATE=1 — migrate 생략.\n");
    return;
  }

  const migrate = spawnSync("npx", ["tsx", "scripts/migrate.ts"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }
}

main();
