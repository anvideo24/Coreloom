import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatLocalUpBanner, LOCAL_DEV_PORT } from "../src/lib/pwa/local-up";
import { funnelHttpsOrigins, tailscaleFunnelArgs, tailscaleFunnelDisableRootArgs } from "../src/lib/pwa/tailscale-funnel";

export const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command: string, args: string[], cwd?: string) {
  return spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true });
}

export function freePort(port: string) {
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

export function waitForPort(port: string, host = "127.0.0.1", timeoutMs = 40000) {
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

export function runTailscale(args: string[]) {
  const result = run("tailscale", args);
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    return run("tailscale.exe", args);
  }
  return result;
}

export function startNextDev() {
  const nextBin = join(webRoot, "node_modules/next/dist/bin/next");
  return spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", LOCAL_DEV_PORT], {
    cwd: webRoot,
    stdio: "inherit",
  });
}

export async function startLocalServer(existing?: ChildProcess | null) {
  if (existing?.pid) existing.kill("SIGTERM");
  freePort(LOCAL_DEV_PORT);
  const child = startNextDev();
  await waitForPort(LOCAL_DEV_PORT);
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
  return child;
}
