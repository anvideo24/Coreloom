import type { ChildProcess } from "node:child_process";

import { PC_DEV_DASHBOARD } from "../src/lib/pwa/local-up";
import { runSyncLocalMain } from "./git-sync";
import { startLocalServer } from "./local-server";

const syncStatus = runSyncLocalMain();
if (syncStatus !== 0) process.exit(syncStatus);

process.stdout.write(`예전 서버가 있으면 끄고 PC 주소 ${PC_DEV_DASHBOARD} 를 다시 엽니다.\n`);

let child: ChildProcess;
try {
  child = await startLocalServer();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "개발 서버를 시작하지 못했습니다."}\n`);
  process.exit(1);
}

function shutdown() {
  if (child.pid) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const exit = await new Promise<number>((resolve) => {
  child.on("exit", (code) => resolve(code ?? 0));
});
process.exit(exit);
