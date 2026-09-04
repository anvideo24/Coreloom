import { FUNNEL_PUBLIC_HTTPS_PORT } from "@/lib/pwa/tailscale-funnel";

export function isCoreloomFunnelOrigin(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".ts.net") && url.port === FUNNEL_PUBLIC_HTTPS_PORT;
  } catch {
    return false;
  }
}

function headerOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function authRequestForUpstream(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!isCoreloomFunnelOrigin(origin) && !isCoreloomFunnelOrigin(headerOrigin(referer))) {
    return request;
  }

  const localOrigin = new URL(request.url).origin;
  const headers = new Headers(request.headers);
  if (isCoreloomFunnelOrigin(origin)) headers.set("origin", localOrigin);
  if (referer && isCoreloomFunnelOrigin(headerOrigin(referer))) {
    const rewritten = new URL(referer);
    const local = new URL(localOrigin);
    rewritten.protocol = local.protocol;
    rewritten.host = local.host;
    headers.set("referer", rewritten.toString());
  }
  return new Request(request, { headers });
}
