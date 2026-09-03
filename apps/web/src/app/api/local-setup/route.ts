import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { localEnvironmentFile, parseLocalSetup } from "@/lib/setup/local-environment";

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "입력값을 읽을 수 없습니다." }, { status: 400 });
  }

  try {
    const values = parseLocalSetup(body);
    const environmentPath = resolve(process.cwd(), ".env.local");

    await writeFile(environmentPath, localEnvironmentFile(values), {
      encoding: "utf8",
      flag: "wx",
    });

    return Response.json({ message: "이 PC의 개발 설정을 저장했습니다. 개발 서버를 다시 시작해 주세요." });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "EEXIST") {
      return Response.json({ message: "기존 .env.local 파일은 보호했습니다. 기존 파일을 직접 확인해 주세요." }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "설정을 저장할 수 없습니다.";
    return Response.json({ message }, { status: 400 });
  }
}
