import { spawnSync } from "node:child_process";

function runTailscale(args) {
  const result = spawnSync("tailscale", args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error && result.error.code === "ENOENT") {
    const fallback = spawnSync("tailscale.exe", args, {
      encoding: "utf8",
      windowsHide: true,
    });
    return fallback;
  }
  return result;
}

const serve = runTailscale(["serve", "--bg", "3000"]);
if (serve.status !== 0) {
  process.stderr.write("Tailscale Serve를 켜지 못했습니다. PC에서 Tailscale이 실행 중인지 확인해 주세요.\n");
  if (serve.stderr) process.stderr.write(serve.stderr);
  process.exit(serve.status === null ? 1 : serve.status);
}

const status = runTailscale(["serve", "status"]);
if (status.status !== 0) {
  process.stderr.write("Tailscale Serve 상태를 읽지 못했습니다.\n");
  if (status.stderr) process.stderr.write(status.stderr);
  process.exit(status.status === null ? 1 : status.status);
}

const output = `${status.stdout ?? ""}${status.stderr ?? ""}`;
if (/\bfunnel\b/i.test(output)) {
  process.stderr.write("Funnel은 공개 인터넷에 노출됩니다. Coreloom에는 Serve만 사용하세요.\n");
  process.exit(1);
}

process.stdout.write(status.stdout || "Tailscale Serve가 이 PC의 포트 3000을 연결했습니다.\n");
