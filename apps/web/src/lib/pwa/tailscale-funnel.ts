export const TAILSCALE_FUNNEL_PORT = "3000";

export function tailscaleFunnelArgs(port = TAILSCALE_FUNNEL_PORT) {
  return ["funnel", "--bg", "--yes", port];
}
