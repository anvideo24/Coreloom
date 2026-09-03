export const TAILSCALE_FUNNEL_PORT = "3000";

export function tailscaleFunnelArgs(port = TAILSCALE_FUNNEL_PORT) {
  return ["funnel", "--bg", "--yes", port];
}

export function funnelHttpsOrigins(statusText: string) {
  const matches = statusText.match(/https:\/\/[a-z0-9.-]+\.ts\.net(?::\d+)?/gi) ?? [];
  return [...new Set(matches.map((url) => url.replace(/\/$/, "")))];
}

export function funnelAuthDomainHint(statusText: string) {
  const origins = funnelHttpsOrigins(statusText);
  if (origins.length === 0) {
    return "휴대폰 로그인이 막히면 Neon Console → Auth → Configuration → Domains에 Funnel HTTPS 주소를 넣습니다. localhost는 이미 허용됩니다.\n";
  }

  return `휴대폰 로그인이 막히면 Neon Console → Auth → Configuration → Domains에 위 HTTPS 주소를 그대로 넣습니다. localhost는 이미 허용됩니다.\n`;
}
