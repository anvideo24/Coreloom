import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatLocalUpBanner, LOCAL_DEV_PORT, PC_DEV_DASHBOARD } from "../src/lib/pwa/local-up";
import { funnelHttpsOrigins, tailscaleFunnelArgs, tailscaleFunnelDisableRootArgs } from "../src/lib/pwa/tailscale-funnel";
import { runSyncLocalMain } from "./git-sync";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command: string, args: string[], cwd?: string) {
  return spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true });
}

function freePort(port: string) {
  if (process.platform === "win32") {
    const netstat = run("netstat", ["-ano"]);
    const pids = new Set<string>();
    for (const line of (netstat.stdout ?? "").split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) run("taskkill", ["/PID", pid, "/F"]);
    return;
  }
  const lsof = run("lsof", ["-ti", `tcp:${port}`]);
  const pids = (lsof.stdout ?? "").trim().split(/\s+/).filter(Boolean);
  for (const pid of pids) run("kill", [pid]);
}

function waitForPort(port: string, host = "127.0.0.1", timeoutMs = 40000) {
  const started = Date.now();
  return new Promise<void>((resolve, reject) => {
    const tryConnect = () => {
      const socket = createConnection({ host, port: Number(port) }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`${host}:${port} 가 열리지 않았습니다.`));
          return;
        }
        setTimeout(tryConnect, 400);
      });
    };
    tryConnect();
  });
}

function runTailscale(args: string[]) {
  const result = run("tailscale", args);
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    return run("tailscale.exe", args);
  }
  return result;
}

const syncStatus = runSyncLocalMain();
if (syncStatus !== 0) process.exit(syncStatus);

process.stdout.write(`예전 서버가 있으면 끄고 PC 주소 ${PC_DEV_DASHBOARD} 를 다시 엽니다.\n`);
freePort(LOCAL_DEV_PORT);

const nextBin = join(webRoot, "node_modules/next/dist/bin/next");
const child: ChildProcess = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", LOCAL_DEV_PORT], {
  cwd: webRoot,
  stdio: "inherit",
});

function shutdown() {
  if (child.pid) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await waitForPort(LOCAL_DEV_PORT);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "개발 서버를 시작하지 못했습니다."}\n`);
  if (child.pid) child.kill("SIGTERM");
  process.exit(1);
}

runTailscale(tailscaleFunnelDisableRootArgs());
const funnel = runTailscale(tailscaleFunnelArgs());
if (funnel.status !== 0) {
  process.stderr.write("휴대폰용 Funnel은 켜지지 않았습니다. PC 주소는 그대로 쓸 수 있습니다.\n");
  if (funnel.stderr) process.stderr.write(funnel.stderr);
  process.stdout.write(formatLocalUpBanner({ phoneOrigins: [] }));
} else {
  const status = runTailscale(["funnel", "status"]);
  process.stdout.write(formatLocalUpBanner({ phoneOrigins: funnelHttpsOrigins(status.stdout ?? "") }));
}

const exit = await new Promise<number>((resolve) => {
  child.on("exit", (code) => resolve(code ?? 0));
});
process.exit(exit);
