import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { appendDevelopmentDatabaseConfig, parseDevelopmentDatabaseSetup } from "@/lib/setup/local-environment";

export const runtime = "nodejs";

function isLocalDevelopmentRequest(request: Request) {
  if (process.env.NODE_ENV === "production") return false;

  const url = new URL(request.url);
  const origin = request.headers.get("origin");

  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname) && origin === url.origin;
}

export async function POST(request: Request) {
  if (!isLocalDevelopmentRequest(request)) {
    return Response.json({ message: "로컬 개발 환경에서만 설정할 수 있습니다." }, { status: 403 });
  }

  try {
    const values = parseDevelopmentDatabaseSetup(await request.json());
    const environmentPath = resolve(process.cwd(), ".env.local");
    const existing = await readFile(environmentPath, "utf8");
    await writeFile(environmentPath, appendDevelopmentDatabaseConfig(existing, values), "utf8");

    return Response.json({ message: "개발 데이터베이스 연결을 저장했습니다. 개발 서버를 다시 시작해 주세요." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "개발 데이터베이스 연결을 저장할 수 없습니다.";
    return Response.json({ message }, { status: 400 });
  }
}
