import { FUNNEL_PUBLIC_HTTPS_PORT } from "@/lib/pwa/tailscale-funnel";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isCoreloomFunnelOrigin(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".ts.net") && url.port === FUNNEL_PUBLIC_HTTPS_PORT;
  } catch {
    return false;
  }
}

export function isLoopbackHost(hostname: string | null | undefined) {
  if (!hostname) return false;
  return LOOPBACK_HOSTS.has(hostname.trim().toLowerCase().replace(/^\[|\]$/g, ""));
}

export function isLoopbackOrigin(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

export function neonTrustedLoopbackOrigin(value: string | null | undefined) {
  if (!isLoopbackOrigin(value)) return null;
  const url = new URL(value as string);
  return url.port ? `http://localhost:${url.port}` : "http://localhost";
}

function headerOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function rewriteLoopbackUrl(value: string, trustedOrigin: string) {
  const rewritten = new URL(value);
  const trusted = new URL(trustedOrigin);
  rewritten.protocol = trusted.protocol;
  rewritten.host = trusted.host;
  return rewritten.toString();
}

export function authRequestForUpstream(request: Request) {
  const headers = new Headers(request.headers);
  let changed = false;

  const origin = headers.get("origin");
  const referer = headers.get("referer");
  if (isCoreloomFunnelOrigin(origin) || isCoreloomFunnelOrigin(headerOrigin(referer))) {
    const localOrigin = new URL(request.url).origin;
    if (isCoreloomFunnelOrigin(origin)) {
      headers.set("origin", localOrigin);
      changed = true;
    }
    if (referer && isCoreloomFunnelOrigin(headerOrigin(referer))) {
      headers.set("referer", rewriteLoopbackUrl(referer, localOrigin));
      changed = true;
    }
  }

  const trustedOrigin = neonTrustedLoopbackOrigin(headers.get("origin"));
  if (trustedOrigin && headers.get("origin") !== trustedOrigin) {
    headers.set("origin", trustedOrigin);
    changed = true;
  }

  const currentReferer = headers.get("referer");
  const trustedRefererOrigin = neonTrustedLoopbackOrigin(headerOrigin(currentReferer));
  if (currentReferer && trustedRefererOrigin && headerOrigin(currentReferer) !== trustedRefererOrigin) {
    headers.set("referer", rewriteLoopbackUrl(currentReferer, trustedRefererOrigin));
    changed = true;
  }

  return changed ? new Request(request, { headers }) : request;
}
