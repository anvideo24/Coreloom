import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decideLocalMainSync } from "../src/lib/pwa/local-up";

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

export function runSyncLocalMain() {
  const root = gitRoot(dirname(fileURLToPath(import.meta.url)));
  const branch = git(root, ["branch", "--show-current"]).stdout.trim();
  const dirty = git(root, ["status", "--porcelain"]).stdout.trim().length > 0;
  git(root, ["fetch", "origin", "main"]);
  const behindMain = Number(git(root, ["rev-list", "--count", "HEAD..origin/main"]).stdout.trim() || "0") > 0;
  const decision = decideLocalMainSync({ branch, dirty, behindMain });
  process.stdout.write(`${decision.message}\n`);
  if (decision.action === "skip") return 0;

  const pull = git(root, ["pull", "--ff-only", "origin", "main"]);
  if (pull.status !== 0) {
    process.stderr.write("main을 받지 못했습니다. 예전 화면이 열릴 수 있습니다.\n");
    if (pull.stderr) process.stderr.write(pull.stderr);
    return pull.status === null ? 1 : pull.status;
  }
  process.stdout.write("origin/main을 받았습니다. PC는 http://127.0.0.1:3000/dashboard 를 엽니다.\n");
  return 0;
}
