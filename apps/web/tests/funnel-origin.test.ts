import { describe, expect, it } from "vitest";

import { authRequestForUpstream, isCoreloomFunnelOrigin } from "@/lib/auth/funnel-origin";

describe("Coreloom Funnel auth origin", () => {
  it("accepts only HTTPS Funnel :8443 hosts", () => {
    expect(isCoreloomFunnelOrigin("https://office.tailnet.ts.net:8443")).toBe(true);
    expect(isCoreloomFunnelOrigin("https://office.tailnet.ts.net")).toBe(false);
    expect(isCoreloomFunnelOrigin("https://office.tailnet.ts.net:10000")).toBe(false);
    expect(isCoreloomFunnelOrigin("http://office.tailnet.ts.net:8443")).toBe(false);
    expect(isCoreloomFunnelOrigin("https://example.com:8443")).toBe(false);
  });

  it("rewrites Funnel Origin to the local Next origin before Neon Auth", () => {
    const request = authRequestForUpstream(new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        origin: "https://office.tailnet.ts.net:8443",
        referer: "https://office.tailnet.ts.net:8443/sign-in",
      },
    }));
    expect(request.headers.get("origin")).toBe("http://127.0.0.1:3000");
    expect(request.headers.get("referer")).toBe("http://127.0.0.1:3000/sign-in");
  });

  it("leaves other origins unchanged", () => {
    const request = authRequestForUpstream(new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin: "https://example.com" },
    }));
    expect(request.headers.get("origin")).toBe("https://example.com");
  });
});
