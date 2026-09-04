export const PC_DEV_ORIGIN = "http://127.0.0.1:3000";
export const PC_DEV_DASHBOARD = `${PC_DEV_ORIGIN}/dashboard`;
export const LOCAL_DEV_PORT = "3000";
export const STAY_UP_INTERVAL_MS = 45_000;

export type LocalSyncDecision = {
  action: "pull" | "skip";
  message: string;
};

export function decideLocalMainSync(input: {
  branch: string;
  dirty: boolean;
  behindMain: boolean;
}): LocalSyncDecision {
  if (input.branch !== "main") {
    return {
      action: "skip",
      message: `현재 브랜치는 ${input.branch}입니다. main을 받지 않고 이 브랜치 화면을 엽니다. PC와 휴대폰은 같은 서버를 봅니다.`,
    };
  }
  if (input.dirty) {
    return {
      action: "skip",
      message: input.behindMain
        ? "저장하지 않은 변경이 있어 main을 받지 못했습니다. 예전 화면이 열릴 수 있습니다. 저장하거나 되돌린 뒤 다시 켜 주세요."
        : "저장하지 않은 변경이 있습니다. 현재 작업 중인 코드로 PC와 휴대폰을 엽니다.",
    };
  }
  if (!input.behindMain) {
    return {
      action: "skip",
      message: "main이 최신입니다. PC는 http://127.0.0.1:3000/dashboard 를 엽니다.",
    };
  }
  return {
    action: "pull",
    message: "origin/main을 받아 PC와 휴대폰이 같은 최신 화면을 보게 합니다.",
  };
}

export function decideStayUpTick(input: {
  branch: string;
  dirty: boolean;
  behindMain: boolean;
  serverRunning: boolean;
}) {
  const sync = decideLocalMainSync(input);
  if (sync.action === "pull") {
    return { pull: true, restart: true, message: `${sync.message} 서버를 다시 켭니다.` };
  }
  if (!input.serverRunning) {
    return { pull: false, restart: true, message: "PC 서버가 꺼져 있어 다시 켭니다." };
  }
  return { pull: false, restart: false, message: sync.message };
}

export function formatLocalUpBanner(input: { phoneOrigins: string[] }) {
  const lines = [
    "PC에서는 Tailscale 없이 아래 주소를 엽니다.",
    PC_DEV_DASHBOARD,
  ];
  if (input.phoneOrigins.length === 0) {
    lines.push("휴대폰 주소는 Funnel이 켜진 뒤에 나옵니다. PC 서버가 꺼지면 휴대폰도 열리지 않습니다.");
    return `${lines.join("\n")}\n`;
  }
  lines.push("휴대폰에서는 Tailscale을 켜지 말고 아래 주소를 엽니다. 다른 사람에게 보내지 마세요.");
  for (const origin of input.phoneOrigins) lines.push(origin);
  return `${lines.join("\n")}\n`;
}
