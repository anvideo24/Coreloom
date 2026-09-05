/**
 * 마이그레이션 대상 확인.
 *
 * 예전에는 `CORELOOM_DATABASE_BRANCH`가 `ai-development`인지만 봤다. 그런데 그 값을 쓰는
 * 두 곳(`local-environment`·`cloud-agent-env`)이 어떤 연결 문자열을 받든 늘 `ai-development`로
 * 적어서, 이 검사는 **어떤 대상이든 통과**했다. 운영 DB를 향해도 막지 못한다.
 *
 * 그래서 이제 **실제로 접속할 곳**을 본다. 사람이 한 번 「이 자리가 개발 DB다」라고
 * 적어 두면(`CORELOOM_DATABASE_HOST`), 그 뒤로 연결 문자열이 다른 곳을 가리키면 멈춘다.
 *
 * ⚠️ 이 관문이 잡는 것과 못 잡는 것을 분명히 해 둔다.
 * - 잡는다: 확인한 뒤에 접속 대상이 **바뀐 것**. 다른 곳의 `.env`를 가져왔거나, 클라우드
 *   비밀이 다른 DB를 가리키거나, 손으로 고쳤을 때.
 * - 못 잡는다: **처음부터 운영 DB 주소를 넣고** 그대로 확인해 버리는 것. 사람이 「이게
 *   개발 DB가 맞나」를 Neon Console 에서 실제로 봐야 한다. 코드는 그것까지 대신 못 한다.
 */

export const DEVELOPMENT_BRANCH = "ai-development";
export const DATABASE_HOST_ENV = "CORELOOM_DATABASE_HOST";

/** 아이디·비밀번호를 뺀 접속 대상. 로그와 오류 메시지에 그대로 써도 된다. */
export function describeDatabaseTarget(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return `${url.host}${url.pathname}`;
}

export function databaseHost(databaseUrl: string): string {
  return new URL(databaseUrl).host;
}

export function assertDevelopmentTarget(input: {
  branch?: string;
  databaseUrl?: string;
  allowedHost?: string;
}): void {
  const branch = input.branch?.trim();
  if (branch !== DEVELOPMENT_BRANCH) {
    throw new Error(`Migration target must be the ${DEVELOPMENT_BRANCH} branch`);
  }

  const databaseUrl = input.databaseUrl?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  let host: string;
  try {
    host = databaseHost(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection string");
  }
  if (!host) {
    // 호스트가 비면 「빈 값을 넣으라」는 안내가 나가고 영원히 안 풀린다.
    throw new Error("DATABASE_URL has no host to confirm");
  }

  const allowedHost = input.allowedHost?.trim();
  if (!allowedHost) {
    // 자동으로 채워 주지 않는다. 사람이 한 번 확인해 적는 것이 이 관문의 전부다.
    throw new Error(
      `${DATABASE_HOST_ENV} is not set. Migrations are refused until the target is confirmed once.\n` +
        `DATABASE_URL currently points at: ${host}\n` +
        `Do NOT paste this blindly. Open the Neon Console and check that this endpoint is the\n` +
        `${DEVELOPMENT_BRANCH} branch — production has a different endpoint. Once verified, add:\n` +
        `${DATABASE_HOST_ENV}="<the ${DEVELOPMENT_BRANCH} endpoint you just verified>"`,
    );
  }

  if (host !== allowedHost) {
    throw new Error(
      `Migration target does not match the confirmed database.\n` +
        `  confirmed: ${allowedHost}\n` +
        `  DATABASE_URL: ${host}`,
    );
  }
}
