import { spawnSync } from "node:child_process";

import { funnelAuthDomainHint, tailscaleFunnelArgs } from "../src/lib/pwa/tailscale-funnel";

function runTailscale(args: string[]) {
  const result = spawnSync("tailscale", args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    return spawnSync("tailscale.exe", args, {
      encoding: "utf8",
      windowsHide: true,
    });
  }
  return result;
}

const funnel = runTailscale(tailscaleFunnelArgs());
if (funnel.status !== 0) {
  process.stderr.write("휴대폰용 주소를 만들지 못했습니다. PC에서 Tailscale이 실행 중인지, 관리 화면에서 Funnel이 허용돼 있는지 확인해 주세요.\n");
  if (funnel.stderr) process.stderr.write(funnel.stderr);
  process.exit(funnel.status === null ? 1 : funnel.status);
}

const status = runTailscale(["funnel", "status"]);
if (status.status !== 0) {
  process.stderr.write("휴대폰용 주소를 읽지 못했습니다.\n");
  if (status.stderr) process.stderr.write(status.stderr);
  process.exit(status.status === null ? 1 : status.status);
}

process.stdout.write("휴대폰에서는 Tailscale을 켜지 마세요. ALT. LIFE처럼 아래 주소를 브라우저에서 연 뒤 홈 화면에 추가하면 됩니다. 이 주소는 다른 사람에게 보내지 마세요.\n");
process.stdout.write(status.stdout || "Funnel이 이 PC의 포트 3000을 연결했습니다.\n");
process.stdout.write(funnelAuthDomainHint(status.stdout ?? ""));
