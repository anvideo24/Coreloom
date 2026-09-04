import { existsSync } from "node:fs";
import { spawnSync, type ChildProcess } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decideStayUpTick, STAY_UP_INTERVAL_MS } from "../src/lib/pwa/local-up";
import { runSyncLocalMain } from "./git-sync";
import { startLocalServer } from "./local-server";

function gitRoot(start: string) {
  let dir = start;
  while (!existsSync(join(dir, ".git"))) {
    const parent = resolve(dir, "..");
    if (parent === dir) throw new Error("Git 저장소를 찾지 못했습니다.");
    dir = parent;
  }
  return dir;
}

function git(root: string, args: string[]) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

const root = gitRoot(dirname(fileURLToPath(import.meta.url)));
let child: ChildProcess | null = null;

function inspect() {
  git(root, ["fetch", "origin", "main"]);
  return {
    branch: git(root, ["branch", "--show-current"]).stdout.trim(),
    dirty: git(root, ["status", "--porcelain"]).stdout.trim().length > 0,
    behindMain: Number(git(root, ["rev-list", "--count", "HEAD..origin/main"]).stdout.trim() || "0") > 0,
    serverRunning: Boolean(child && child.exitCode === null),
  };
}

async function tick() {
  const state = inspect();
  const decision = decideStayUpTick(state);
  if (!decision.pull && !decision.restart) return;
  process.stdout.write(`${decision.message}\n`);
  if (decision.pull) {
    const status = runSyncLocalMain();
    if (status !== 0) return;
  }
  try {
    child = await startLocalServer(child);
    child.on("exit", (code) => {
      if (child && child.exitCode === code) child = null;
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "개발 서버를 다시 켜지 못했습니다."}\n`);
    child = null;
  }
}

process.stdout.write(`PC가 origin/main을 ${STAY_UP_INTERVAL_MS / 1000}초마다 확인하고, 합쳐진 코드가 있으면 서버와 Funnel을 다시 켭니다. 끄려면 Ctrl+C.\n`);
await tick();
setInterval(() => {
  void tick();
}, STAY_UP_INTERVAL_MS);

function shutdown() {
  if (child?.pid) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
